#!/usr/bin/env node
import { findSchemaRoot, parseArgs, readJson, schemaPath } from './schema-utils.mjs'

const args = parseArgs(process.argv.slice(2))
const [kind, name] = args._

if (!kind || !name) {
	console.error('Usage: node scripts/get-schema.mjs <element|control|global|settings|general> <name> [--schema-root <path>] [--compact] [--list-settings] [--settings key1,key2]')
	process.exit(1)
}

const normalizedKind =
	kind === 'elements'
		? 'element'
		: kind === 'controls'
			? 'control'
			: kind === 'generals'
				? 'general'
				: kind
const root = findSchemaRoot(args['schema-root'])

if (!root) {
	console.error('No schema root found. Pass --schema-root /path/to/schema-docs-bundle/schema-resolved or /path/to/includes/schema.')
	process.exit(1)
}

const path = schemaPath(root, normalizedKind, name)

if (!path) {
	console.error(`Schema not found for ${normalizedKind} "${name}" under ${root}.`)
	process.exit(1)
}

const schema = readJson(path)
const settings = schema.settings || schema.controls || {}

function pickValueSchema(source) {
	const keys = [
		'type',
		'description',
		'properties',
		'items',
		'required',
		'additionalProperties',
		'oneOf',
		'anyOf',
		'allOf',
		'enum',
		'controlProperties'
	]

	return Object.fromEntries(
		keys
			.filter((key) => Object.prototype.hasOwnProperty.call(source, key))
			.map((key) => [key, source[key]])
	)
}

if (args['list-settings']) {
	const rows = Object.entries(settings).map(([key, control]) => ({
		key,
		type: control.controlType || control.type || null,
		label: control.label || null,
		hasRequired: !!control.hasRequired
	}))

	console.log(JSON.stringify({ source: path, settings: rows }, null, 2))
	process.exit(0)
}

if (!args.compact) {
	console.log(JSON.stringify(schema, null, 2))
	process.exit(0)
}

const settingFilter = String(args.settings || args.setting || '')
	.split(',')
	.map((key) => key.trim())
	.filter(Boolean)

const settingEntries = settingFilter.length
	? Object.entries(settings).filter(([key]) => settingFilter.includes(key))
	: Object.entries(settings)

const compact = {
	source: path,
	id: schema.$id,
	title: schema.title,
	description: schema.description,
	metadata: schema.metadata || null,
	missingSettings: settingFilter.filter((key) => !Object.prototype.hasOwnProperty.call(settings, key))
}

if (Object.keys(settings).length) {
	compact.settings = Object.fromEntries(
		settingEntries.map(([key, control]) => [
			key,
			{
				type: control.controlType || control.type || null,
				label: control.label || null,
				options: control.options || null,
				default: control.default ?? null,
				hasRequired: !!control.hasRequired,
				css: control.css || null,
				valueSchema: control.valueSchema || null
			}
		])
	)
} else {
	compact.valueSchema = pickValueSchema(schema)
}

console.log(JSON.stringify(compact, null, 2))
