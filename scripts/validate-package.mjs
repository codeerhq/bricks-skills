#!/usr/bin/env node

import fs from 'node:fs'
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

export const validatePackage = ({ root = scriptRoot, trackedFiles } = {}) => {
	const skillsRoot = path.join(root, 'skills')
	const errors = []
	const fail = (message) => errors.push(message)
	const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
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

 return { errors, skillCount: skillDirectories.length, version }
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
  if (flag !== '--root') {
			throw new Error(`unknown argument ${argument}`)
		}
		const value = inlineValue ?? argv[++index]
		if (!value) {
			throw new Error(`${flag} requires a path`)
		}
  options.root = path.resolve(value)
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
 console.log(`Validated ${result.skillCount} skills for ${result.version}.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main()
}
