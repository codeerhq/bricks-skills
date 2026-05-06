#!/usr/bin/env node
import {
	COMMON_ELEMENTS,
	CONVERTER_ELEMENTS,
	findSchemaRoot,
	listSchemaFiles,
	loadManifest,
	parseArgs
} from './schema-utils.mjs'

const args = parseArgs(process.argv.slice(2))
const manifest = loadManifest()

if (args.common || args.converter) {
	const names = args.common ? COMMON_ELEMENTS : CONVERTER_ELEMENTS
	const items = [...names].sort()
	console.log(items.join('\n'))
	process.exit(0)
}

if (manifest && !args['schema-root']) {
	const elements = manifest.elements || []
	const rows = elements.map((element) => ({
		name: element.name,
		category: element.category || '',
		nestable: !!element.nestable,
		common: !!element.common,
		converter: !!element.converter
	}))

	console.log(JSON.stringify({ source: 'manifest', elements: rows }, null, 2))
	process.exit(0)
}

const root = findSchemaRoot(args['schema-root'])

if (!root) {
	console.error('No schema root found. Pass --schema-root /path/to/schema-docs-bundle/schema-resolved or /path/to/includes/schema.')
	process.exit(1)
}

const output = {
	source: root,
	elements: listSchemaFiles(root, 'element'),
	controls: listSchemaFiles(root, 'control'),
	general: listSchemaFiles(root, 'general'),
	global: listSchemaFiles(root, 'global'),
	settings: listSchemaFiles(root, 'settings')
}

console.log(JSON.stringify(output, null, 2))
