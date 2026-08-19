#!/usr/bin/env node

import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const walk = (directory) =>
	fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.name === '.git') {
			return []
		}

		const entryPath = path.join(directory, entry.name)
		return entry.isDirectory() ? walk(entryPath) : [entryPath]
	})

const parseScalar = (value, location) => {
	if (value.startsWith('"')) {
		try {
			return JSON.parse(value)
		} catch (error) {
			throw new Error(`${location}: invalid double-quoted YAML scalar (${error.message})`)
		}
	}

	if (value.startsWith("'")) {
		if (!value.endsWith("'") || value.length < 2) {
			throw new Error(`${location}: unterminated single-quoted YAML scalar`)
		}
		return value.slice(1, -1).replaceAll("''", "'")
	}

	if (/^(?:true|false)$/.test(value)) {
		return value === 'true'
	}
	if (value === 'null' || value === '~') {
		return null
	}
	if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
		return Number(value)
	}

	return value
}

/** Parse the small, deterministic YAML subset used by skill metadata. */
export const parseSimpleYaml = (contents, relativePath = '<yaml>') => {
	const root = {}
	const stack = [{ indent: -1, value: root }]

	for (const [index, rawLine] of contents.replaceAll('\r\n', '\n').split('\n').entries()) {
		const lineNumber = index + 1
		if (/^\s*(?:#.*)?$/.test(rawLine)) {
			continue
		}
		if (rawLine.includes('\t')) {
			throw new Error(`${relativePath}:${lineNumber}: tabs are not valid YAML indentation`)
		}

		const indent = rawLine.match(/^ */)[0].length
		while (stack.at(-1).indent >= indent) {
			stack.pop()
		}

		const parent = stack.at(-1)?.value
		if (!parent || Array.isArray(parent)) {
			throw new Error(`${relativePath}:${lineNumber}: invalid YAML nesting`)
		}

		const line = rawLine.slice(indent)
		const listMatch = line.match(/^-\s+(.+)$/)
		if (listMatch) {
			const list = parent.__listCandidate
			if (!Array.isArray(list)) {
				throw new Error(`${relativePath}:${lineNumber}: list item has no parent key`)
			}
			list.push(parseScalar(listMatch[1], `${relativePath}:${lineNumber}`))
			continue
		}

		const keyMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/)
		if (!keyMatch) {
			throw new Error(`${relativePath}:${lineNumber}: unsupported or invalid YAML`)
		}

		const [, key, scalar] = keyMatch
		if (Object.hasOwn(parent, key)) {
			throw new Error(`${relativePath}:${lineNumber}: duplicate YAML key ${key}`)
		}

		if (scalar === undefined) {
			const child = {}
			const list = []
			parent[key] = child
			Object.defineProperty(child, '__listCandidate', { value: list, enumerable: false })
			stack.push({ indent, value: child, parent, key })
		} else {
			parent[key] = parseScalar(scalar, `${relativePath}:${lineNumber}`)
		}
	}

	const normalize = (value) => {
		if (!value || typeof value !== 'object') {
			return value
		}
		if (value.__listCandidate?.length > 0 && Object.keys(value).length === 0) {
			return value.__listCandidate.map(normalize)
		}
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]))
	}

	return normalize(root)
}

export const parseFrontmatter = (contents, relativePath) => {
	const normalized = contents.replaceAll('\r\n', '\n')
	if (!normalized.startsWith('---\n')) {
		throw new Error(`${relativePath}: missing opening YAML frontmatter delimiter`)
	}
	const end = normalized.indexOf('\n---\n', 4)
	if (end === -1) {
		throw new Error(`${relativePath}: missing closing YAML frontmatter delimiter`)
	}
	return parseSimpleYaml(normalized.slice(4, end), relativePath)
}

const extractLocalLinks = (contents) =>
	[...contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)]
		.map((match) => match[1].trim().replace(/\s+["'].*["']$/, ''))
		.filter((target) => target && !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target))
		.map((target) => decodeURIComponent(target.split('#')[0]))

const normalizeManifest = (raw, relativePath) => {
	const entries = Array.isArray(raw) ? raw : raw?.abilities
	if (!Array.isArray(entries)) {
		throw new Error(`${relativePath}: runtime manifest must be an array or an object with an abilities array`)
	}

	const requireSchemaDigests = raw?.generatedFrom?.inputSchemaDigests === 'complete'
	const abilities = new Map()
	for (const [index, entry] of entries.entries()) {
		const record = typeof entry === 'string' ? { name: entry } : entry
		if (!record || typeof record.name !== 'string' || !/^bricks\/[a-z0-9-]+$/.test(record.name)) {
			throw new Error(`${relativePath}: abilities[${index}] has no valid Bricks ability name`)
		}
		if (abilities.has(record.name)) {
			throw new Error(`${relativePath}: duplicate ability ${record.name}`)
		}
		const inputSchemaDigest = record.input_schema_digest ?? record.inputSchemaDigest ?? null
		if (inputSchemaDigest !== null && !/^[a-f0-9]{64}$/.test(inputSchemaDigest)) {
			throw new Error(`${relativePath}: ${record.name} has an invalid input schema digest`)
		}
		if (requireSchemaDigests && inputSchemaDigest === null) {
			throw new Error(`${relativePath}: ${record.name} has no input schema digest`)
		}
		const inputSchema = record.input_schema ?? record.inputSchema ?? null
		if (inputSchema && inputSchemaDigest) {
			const actualDigest = crypto.createHash('sha256').update(JSON.stringify(inputSchema)).digest('hex')
			if (actualDigest !== inputSchemaDigest) {
				throw new Error(`${relativePath}: ${record.name} embedded input schema does not match its digest`)
			}
		}
		abilities.set(record.name, {
			inputSchema,
			inputSchemaDigest
		})
	}
	return abilities
}

export const abilitiesFromSource = (sourceRoot) => {
	const managerPath = path.join(sourceRoot, 'includes/abilities/manager.php')
	if (!fs.existsSync(managerPath)) {
		throw new Error(`${managerPath}: Bricks ability manager not found`)
	}
	const contents = fs.readFileSync(managerPath, 'utf8')
	const names = [...contents.matchAll(/\$this->register\(\s*'(bricks\/[a-z0-9-]+)'/g)].map((match) => match[1])

	for (const loop of contents.matchAll(/foreach\s*\(\s*\[([\s\S]*?)\]\s*as\s*\$(\w+)\s*=>[^)]*\)\s*\{([\s\S]*?)\n\t\t\}/g)) {
		const [, entries, variable, body] = loop
		const expression = new RegExp(`'bricks/\\s*'\\s*\\.\\s*\\$${variable}\\s*\\.\\s*'([^']*)'`)
		const suffix = body.match(expression)?.[1]
		if (suffix === undefined) {
			continue
		}
		for (const key of entries.matchAll(/'([a-z0-9-]+)'\s*=>/g)) {
			names.push(`bricks/${key[1]}${suffix}`)
		}
	}

	if (names.length === 0) {
		throw new Error(`${managerPath}: no literal Bricks ability registrations found`)
	}

	const uniqueNames = [...new Set(names)].sort()
	const fixturePath = path.join(sourceRoot, 'tests/unit/abilities/fixtures/registry-manifest.json')
	if (!fs.existsSync(fixturePath)) {
		return new Map(uniqueNames.map((name) => [name, { inputSchema: null, inputSchemaDigest: null }]))
	}

	const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
	const fixtureNames = Object.keys(fixture).sort()
	if (JSON.stringify(fixtureNames) !== JSON.stringify(uniqueNames)) {
		throw new Error(`${fixturePath}: ability surface does not match the runtime manager`)
	}
	return new Map(uniqueNames.map((name) => {
		const digest = fixture[name]?.inputSchema
		if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) {
			throw new Error(`${fixturePath}: ${name} has no valid input schema digest`)
		}
		return [name, { inputSchema: null, inputSchemaDigest: digest }]
	}))
}

const compareRuntimeContracts = (manifestAbilities, sourceAbilities, fail) => {
	for (const name of new Set([...manifestAbilities.keys(), ...sourceAbilities.keys()])) {
		if (!manifestAbilities.has(name)) {
			fail(`runtime manifest is missing source ability ${name}`)
			continue
		}
		if (!sourceAbilities.has(name)) {
			fail(`runtime manifest contains ability absent from source ${name}`)
			continue
		}
		const manifestDigest = manifestAbilities.get(name).inputSchemaDigest
		const sourceDigest = sourceAbilities.get(name).inputSchemaDigest
		if (manifestDigest && sourceDigest && manifestDigest !== sourceDigest) {
			fail(`runtime manifest input schema drifted from source for ${name}`)
		}
	}
}

const schemaErrors = (value, schema, location) => {
	if (!schema || typeof schema !== 'object') {
		return []
	}
	const errors = []
	const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []
	const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value
	if (types.length > 0 && !types.includes(actualType) && !(actualType === 'integer' && types.includes('number'))) {
		return [`${location} must be ${types.join(' or ')}, got ${actualType}`]
	}
	if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
		errors.push(`${location} is not one of the allowed values`)
	}
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		for (const required of schema.required ?? []) {
			if (!Object.hasOwn(value, required)) {
				errors.push(`${location}.${required} is required`)
			}
		}
		for (const [key, item] of Object.entries(value)) {
			if (schema.properties?.[key]) {
				errors.push(...schemaErrors(item, schema.properties[key], `${location}.${key}`))
			} else if (schema.additionalProperties === false) {
				errors.push(`${location}.${key} is not allowed`)
			}
		}
	}
	if (Array.isArray(value) && schema.items) {
		value.forEach((item, index) => errors.push(...schemaErrors(item, schema.items, `${location}[${index}]`)))
	}
	return errors
}

const validateRuntimeExamples = (contents, relativePath, abilities, skillNames, fail) => {
	const referenced = new Set()
	const documentedNonAbilityCalls = new Set([
		'add-to-cart',
		'builder',
		'data',
		'element-php',
		'frontend',
		'generate-control-index',
		'get-schema',
		'icons',
		'save-submission',
		'scripts',
		'set-design-setting',
		'set-element-attributes',
		'set-element-label',
		'set-text',
		'set-variable-value',
		'skills',
		'splide',
		'theme-styles',
		'update-post',
		'insert-text-before'
	])

	// Inline code commonly uses direct MCP aliases (`bricks-get-...`) or the
	// readable ability suffix (`get-...`). Unprefixed tokens are references only
	// when they exactly match the runtime surface: edit-plan operation names such
	// as `set-text` intentionally share verbs with abilities.
	for (const code of contents.matchAll(/`([^`\n]+)`/g)) {
		const slashCall = code[1].trim().match(/^(bricks\/[a-z0-9-]+)(?:\s*\(|\s*$)/)
		if (slashCall) {
			referenced.add(slashCall[1])
		}
		for (const match of code[1].matchAll(/\b(?:bricks-)?[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g)) {
			const directAlias = match[0].startsWith('bricks-')
			const token = directAlias ? match[0].slice(7) : match[0]
			if (directAlias && skillNames.has(match[0])) {
				continue
			}
			if (!documentedNonAbilityCalls.has(token) && (directAlias || abilities.has(`bricks/${token}`))) {
				referenced.add(`bricks/${token}`)
			}
		}
	}

	// Bricks workflow examples often use the readable `ability-name({...})`
	// form instead of JSON. Hyphenated call names are ability references in
	// fenced examples; ordinary local helpers remain camelCase.
	for (const block of contents.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)) {
		for (const match of block[1].matchAll(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\s*\(\s*(?=\{|[A-Za-z][A-Za-z0-9]*\s*:)/g)) {
			const call = match[1].startsWith('bricks-') ? match[1].slice(7) : match[1]
			if (!documentedNonAbilityCalls.has(call)) {
				referenced.add(`bricks/${call}`)
			}
		}
	}

	for (const name of referenced) {
		const legacyTransfer = new Set(['bricks/import-global-data', 'bricks/export-global-data', 'bricks/import-template-bundle', 'bricks/export-templates'])
		if (!abilities.has(name) && !legacyTransfer.has(name)) {
			fail(`${relativePath} references unknown ability ${name}`)
		}
	}

	for (const match of contents.matchAll(/ability_name["']?\s*:\s*["'](bricks\/[a-z0-9-]+)["']/g)) {
		if (!abilities.has(match[1])) {
			fail(`${relativePath} references unknown ability ${match[1]}`)
		}
	}

	for (const match of contents.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
		let example
		try {
			example = JSON.parse(match[1])
		} catch {
			continue
		}
		if (!example || typeof example.ability_name !== 'string' || !example.ability_name.startsWith('bricks/')) {
			continue
		}
		if (!abilities.has(example.ability_name)) {
			fail(`${relativePath} JSON example references unknown ability ${example.ability_name}`)
			continue
		}
		const schema = abilities.get(example.ability_name)?.inputSchema
		if (schema) {
			for (const error of schemaErrors(example.parameters ?? {}, schema, 'parameters')) {
				fail(`${relativePath} ${example.ability_name} example: ${error}`)
			}
		}
	}
}

const validateLiteralElementIds = (contents, relativePath, fail) => {
	for (const match of contents.matchAll(/\b(elementId|rootElementId|parentId)["']?\s*:\s*["']([^"']+)["']/g)) {
		const [, field, value] = match
		if (value === '0' || /^<[^>]+>$/.test(value)) {
			continue
		}
		if (!/^[A-Za-z0-9]{6}$/.test(value)) {
			fail(`${relativePath} uses invalid literal ${field} ${value}; Bricks element IDs must be exactly 6 alphanumeric characters`)
		}
	}
}

export const validatePackage = ({ root = scriptRoot, runtimeManifest, bricksSource, trackedFiles } = {}) => {
	const skillsRoot = path.join(root, 'skills')
	const errors = []
	const fail = (message) => errors.push(message)
	const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
	let abilities = null

	try {
		if (runtimeManifest) {
			abilities = normalizeManifest(JSON.parse(fs.readFileSync(runtimeManifest, 'utf8')), runtimeManifest)
		}
		if (bricksSource) {
			const sourceAbilities = abilitiesFromSource(bricksSource)
			if (abilities) {
				compareRuntimeContracts(abilities, sourceAbilities, fail)
			} else {
				abilities = sourceAbilities
			}
		}
	} catch (error) {
		fail(error.message)
	}

	const version = read('VERSION').trim()
	if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
		fail(`VERSION is not valid SemVer: ${version}`)
	}

	let marketplace
	try {
		marketplace = JSON.parse(read('.claude-plugin/marketplace.json'))
	} catch (error) {
		fail(`marketplace.json is invalid JSON: ${error.message}`)
	}
	if (marketplace?.metadata?.version !== version) {
		fail(`marketplace version ${marketplace?.metadata?.version ?? '<missing>'} does not match VERSION ${version}`)
	}
	if (!read('CHANGELOG.md').includes(`## ${version}`)) {
		fail(`CHANGELOG.md has no heading for ${version}`)
	}
	if (!read('README.md').includes(`v${version}`)) {
		fail(`README.md release example does not match v${version}`)
	}

	for (const jsonPath of walk(root).filter((filePath) => filePath.endsWith('.json'))) {
		try {
			JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
		} catch (error) {
			fail(`${path.relative(root, jsonPath)} is invalid JSON: ${error.message}`)
		}
	}

	const skillDirectories = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
	const skillNames = new Set(skillDirectories)
	for (const directory of skillDirectories) {
		const skillPath = path.join(skillsRoot, directory, 'SKILL.md')
		const relativeSkillPath = path.relative(root, skillPath)
		if (!fs.existsSync(skillPath)) {
			fail(`skills/${directory} has no SKILL.md`)
			continue
		}

		const contents = fs.readFileSync(skillPath, 'utf8')
		try {
			const metadata = parseFrontmatter(contents, relativeSkillPath)
			if (metadata.name !== directory) {
				fail(`${relativeSkillPath} name is ${metadata.name ?? '<missing>'}`)
			}
			if (typeof metadata.description !== 'string' || metadata.description.trim() === '') {
				fail(`${relativeSkillPath} has no description`)
			}
		} catch (error) {
			fail(error.message)
		}

		for (const alias of ['bricks-list-element-types', 'bricks-get-element-schema']) {
			if (contents.includes(alias)) {
				fail(`${relativeSkillPath} uses dispatcher-only direct-tool alias ${alias}`)
			}
		}
		if (directory !== 'bricks-import-export' && /(?:bricks\/)?(?:import-global-data|export-global-data|import-template-bundle|export-templates)/.test(contents)) {
			fail(`${relativeSkillPath} references a legacy transfer ability`)
		}
		for (const markdownPath of walk(path.join(skillsRoot, directory)).filter((filePath) => filePath.endsWith('.md'))) {
			const relativeMarkdownPath = path.relative(root, markdownPath)
			const markdown = fs.readFileSync(markdownPath, 'utf8')
			for (const target of extractLocalLinks(markdown)) {
				const resolved = path.resolve(path.dirname(markdownPath), target)
				if (!fs.existsSync(resolved)) {
					fail(`${relativeMarkdownPath} links to missing local file ${target}`)
				}
			}
			validateLiteralElementIds(markdown, relativeMarkdownPath, fail)
			if (abilities) {
				validateRuntimeExamples(markdown, relativeMarkdownPath, abilities, skillNames, fail)
			}
		}

		const openaiPath = path.join(skillsRoot, directory, 'agents/openai.yaml')
		if (fs.existsSync(openaiPath)) {
			const relativeOpenaiPath = path.relative(root, openaiPath)
			try {
				const metadata = parseSimpleYaml(fs.readFileSync(openaiPath, 'utf8'), relativeOpenaiPath)
				for (const key of ['display_name', 'short_description', 'default_prompt']) {
					if (typeof metadata.interface?.[key] !== 'string' || metadata.interface[key].trim() === '') {
						fail(`${relativeOpenaiPath} has no interface.${key}`)
					}
				}
			} catch (error) {
				fail(error.message)
			}
		}
	}

	const manifestSkills = (marketplace?.plugins?.[0]?.skills ?? []).map((skill) => skill.replace(/^\.\/skills\//, '')).sort()
	if (JSON.stringify(manifestSkills) !== JSON.stringify(skillDirectories)) {
		fail('marketplace skill list does not exactly match skills/ directories')
	}
	const readmeSkills = [...read('README.md').matchAll(/^\| \*\*(bricks-[^*]+)\*\* \|/gm)].map((match) => match[1]).sort()
	if (JSON.stringify(readmeSkills) !== JSON.stringify(skillDirectories)) {
		fail('README skill table does not exactly match skills/ directories')
	}

	if (trackedFiles) {
		for (const filePath of walk(skillsRoot)) {
			const relativePath = path.relative(root, filePath)
			if (!trackedFiles.has(relativePath)) {
				fail(`${relativePath} is part of the package but is not tracked by git`)
			}
		}
	}

	return { errors, skillCount: skillDirectories.length, version, abilityCount: abilities?.size ?? null }
}

const parseArguments = (argv) => {
	const options = {}
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index]
		if (argument === '--check-git-index') {
			options.checkGitIndex = true
			continue
		}
		const [flag, inlineValue] = argument.split('=', 2)
		if (!['--root', '--runtime-manifest', '--bricks-source'].includes(flag)) {
			throw new Error(`unknown argument ${argument}`)
		}
		const value = inlineValue ?? argv[++index]
		if (!value) {
			throw new Error(`${flag} requires a path`)
		}
		options[{ '--root': 'root', '--runtime-manifest': 'runtimeManifest', '--bricks-source': 'bricksSource' }[flag]] = path.resolve(value)
	}
	return options
}

const main = () => {
	let options
	try {
		options = parseArguments(process.argv.slice(2))
		if (options.checkGitIndex) {
			const root = options.root ?? scriptRoot
			const result = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' })
			if (result.status !== 0) {
				throw new Error(`git ls-files failed: ${result.stderr.trim()}`)
			}
			options.trackedFiles = new Set(result.stdout.split('\0').filter(Boolean))
		}
	} catch (error) {
		console.error(`ERROR: ${error.message}`)
		process.exit(2)
	}

	const result = validatePackage(options)
	if (result.errors.length > 0) {
		for (const error of result.errors) {
			console.error(`ERROR: ${error}`)
		}
		process.exit(1)
	}
	const runtimeSuffix = result.abilityCount === null ? '' : ` against ${result.abilityCount} runtime abilities`
	console.log(`Validated ${result.skillCount} skills for ${result.version}${runtimeSuffix}.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main()
}
