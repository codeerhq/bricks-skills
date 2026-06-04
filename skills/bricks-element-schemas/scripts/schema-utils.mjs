import { existsSync, readFileSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const skillRoot = resolve(__dirname, '..')

export const COMMON_ELEMENTS = new Set([
	'section',
	'container',
	'block',
	'div',
	'heading',
	'text-basic',
	'button',
	'image',
	'icon',
	'form',
	'nav-nested'
])

export const CONVERTER_ELEMENTS = new Set([
	'section',
	'div',
	'heading',
	'text-basic',
	'text-link',
	'icon',
	'button',
	'image',
	'svg',
	'video',
	'audio',
	'code',
	'divider',
	'form'
])

export function parseArgs(argv) {
	const args = { _: [] }

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]

		if (!arg.startsWith('--')) {
			args._.push(arg)
			continue
		}

		const key = arg.slice(2)
		const next = argv[i + 1]

		if (!next || next.startsWith('--')) {
			args[key] = true
			continue
		}

		args[key] = next
		i++
	}

	return args
}

export function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'))
}

export function findSchemaRoot(explicitRoot) {
	const candidates = []

	if (explicitRoot) {
		candidates.push(resolve(explicitRoot))
	}

	if (process.env.BRICKS_SCHEMA_ROOT) {
		candidates.push(resolve(process.env.BRICKS_SCHEMA_ROOT))
	}

	let current = process.cwd()

	while (true) {
		candidates.push(join(current, 'schema-docs-bundle', 'schema-resolved'))
		candidates.push(join(current, 'includes', 'schema'))

		const parent = dirname(current)
		if (parent === current) {
			break
		}

		current = parent
	}

	candidates.push(join(skillRoot, 'references', 'schema-resolved'))

	for (const candidate of candidates) {
		if (existsSync(join(candidate, 'elements')) || existsSync(join(candidate, 'controls'))) {
			return candidate
		}
	}

	return null
}

export function schemaPath(root, kind, name) {
	const normalizedKind =
		kind === 'setting' ? 'settings' : kind === 'general' ? 'general' : `${kind}s`
	const candidate = join(root, normalizedKind, `${name}.json`)

	if (existsSync(candidate)) {
		return candidate
	}

	if (kind === 'global') {
		const globalCandidate = join(root, 'global', `${name}.json`)
		return existsSync(globalCandidate) ? globalCandidate : null
	}

	if (kind === 'settings') {
		const settingsCandidate = join(root, 'settings', `${name}.json`)
		return existsSync(settingsCandidate) ? settingsCandidate : null
	}

	if (kind === 'general') {
		const generalCandidate = join(root, 'general', `${name}.json`)
		return existsSync(generalCandidate) ? generalCandidate : null
	}

	return null
}

export function listSchemaFiles(root, kind) {
	const dirName =
		kind === 'global'
			? 'global'
			: kind === 'settings'
				? 'settings'
				: kind === 'general'
					? 'general'
					: `${kind}s`
	const dir = join(root, dirName)

	if (!existsSync(dir)) {
		return []
	}

	return readdirSync(dir)
		.filter((file) => file.endsWith('.json'))
		.map((file) => file.replace(/\.json$/, ''))
		.sort()
}

export function loadManifest() {
	const manifestPath = join(skillRoot, 'references', 'schema-manifest.json')
	return existsSync(manifestPath) ? readJson(manifestPath) : null
}
