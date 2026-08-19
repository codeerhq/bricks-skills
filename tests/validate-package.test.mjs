import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { abilitiesFromSource, parseFrontmatter, parseSimpleYaml, validatePackage } from '../scripts/validate-package.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')

const makePackage = () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bricks-skills-validator-'))
	fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true })
	fs.mkdirSync(path.join(root, 'skills/bricks-example/references'), { recursive: true })
	fs.mkdirSync(path.join(root, 'skills/bricks-example/agents'), { recursive: true })
	fs.writeFileSync(path.join(root, 'VERSION'), '1.2.3\n')
	fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '## 1.2.3\n')
	fs.writeFileSync(path.join(root, 'README.md'), 'Install v1.2.3\n\n| Skill | Purpose |\n| --- | --- |\n| **bricks-example** | Example |\n')
	fs.writeFileSync(path.join(root, '.claude-plugin/marketplace.json'), JSON.stringify({ metadata: { version: '1.2.3' }, plugins: [{ skills: ['./skills/bricks-example'] }] }))
	fs.writeFileSync(path.join(root, 'skills/bricks-example/references/guide.md'), '# Guide\n')
	fs.writeFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), `---\nname: bricks-example\ndescription: "Example: validates runtime calls"\n---\n\nRead [the guide](references/guide.md).\n\n\`\`\`json\n{\n  "ability_name": "bricks/do-thing",\n  "parameters": { "id": 7 }\n}\n\`\`\`\n`)
	fs.writeFileSync(path.join(root, 'skills/bricks-example/agents/openai.yaml'), 'interface:\n  display_name: "Bricks example"\n  short_description: "Validate a Bricks example"\n  default_prompt: "Use the example skill."\n')
	return root
}

const writeManifest = (root, abilities) => {
	const manifest = path.join(root, 'runtime.json')
	fs.writeFileSync(manifest, JSON.stringify({ abilities }))
	return manifest
}

test('parses frontmatter and nested OpenAI metadata without external YAML dependencies', () => {
	assert.deepEqual(parseFrontmatter('---\nname: demo\ndescription: "A: demo"\nallowed-tools:\n  - Bash\n---\n', 'SKILL.md'), {
		name: 'demo',
		description: 'A: demo',
		'allowed-tools': ['Bash']
	})
	assert.deepEqual(parseSimpleYaml('interface:\n  display_name: "Demo"\n'), { interface: { display_name: 'Demo' } })
	assert.throws(() => parseSimpleYaml('name: one\nname: two\n', 'bad.yaml'), /duplicate YAML key/)
})

test('valid package accepts local references and runtime-backed JSON examples', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	const runtimeManifest = writeManifest(root, [{
		name: 'bricks/do-thing',
		input_schema: {
			type: 'object',
			required: ['id'],
			properties: { id: { type: 'integer' } },
			additionalProperties: false
		}
	}])
	assert.deepEqual(validatePackage({ root, runtimeManifest }).errors, [])
})

test('reports broken links, malformed metadata, unknown abilities, schema drift, and untracked package files', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.rmSync(path.join(root, 'skills/bricks-example/references/guide.md'))
	fs.writeFileSync(path.join(root, 'skills/bricks-example/agents/openai.yaml'), 'interface:\n  display_name: "Bricks example"\n  display_name: "Duplicate"\n')
	fs.writeFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), `---\nname: bricks-example\ndescription: Example\n---\n\n[missing](references/guide.md)\n\nelementId: "too-long"\n\n\`\`\`json\n{ "ability_name": "bricks/unknown", "parameters": { "id": "wrong" } }\n\`\`\`\n`)
	const runtimeManifest = writeManifest(root, [{ name: 'bricks/do-thing', input_schema: { type: 'object' } }])
	const result = validatePackage({ root, runtimeManifest, trackedFiles: new Set() })
	assert(result.errors.some((error) => error.includes('missing local file')))
	assert(result.errors.some((error) => error.includes('duplicate YAML key')))
	assert(result.errors.some((error) => error.includes('unknown ability bricks/unknown')))
	assert(result.errors.some((error) => error.includes('invalid literal elementId too-long')))
	assert(result.errors.some((error) => error.includes('not tracked by git')))
	assert.equal(new Set(result.errors).size, result.errors.length)
})

test('validates local links and runtime examples in bundled Markdown references', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.writeFileSync(path.join(root, 'skills/bricks-example/references/guide.md'), '[missing](other.md)\n\n```json\n{ "ability_name": "bricks/not-real", "parameters": {} }\n```\n')
	const runtimeManifest = writeManifest(root, ['bricks/do-thing'])
	const errors = validatePackage({ root, runtimeManifest }).errors
	assert(errors.some((error) => error.includes('references/guide.md links to missing local file other.md')))
	assert(errors.some((error) => error.includes('references/guide.md JSON example references unknown ability bricks/not-real')))
})

test('validates slash-form and readable pseudocode ability references', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.appendFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), '\nUse `bricks/not-real`, `do-thign`, `bricks-do-thign`, `bricks/inline-thign({ id: 1 })`, and the `bricks-example` skill:\n\n```js\nalso-not-real({ id: 1 })\n```\n')
	const runtimeManifest = writeManifest(root, ['bricks/do-thing'])
	const errors = validatePackage({ root, runtimeManifest }).errors
	assert(errors.some((error) => error.includes('unknown ability bricks/not-real')))
	assert(errors.some((error) => error.includes('unknown ability bricks/do-thign')))
	assert(errors.some((error) => error.includes('unknown ability bricks/inline-thign')))
	assert(errors.some((error) => error.includes('unknown ability bricks/also-not-real')))
})

test('does not mistake typed edit operations for abilities', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.appendFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), '\nSupported operations include `set-text`, `insert-text-before`, `set-element-label`, `set-element-attributes`, `set-variable-value`, and `set-design-setting`. A WordPress hook may be passed as `add_filter( "bricks/css", $callback )`.\n\n```js\nset-text({ value: "Updated" })\n```\n')
	const runtimeManifest = writeManifest(root, ['bricks/do-thing', 'bricks/set-setting', 'bricks/insert-element'])
	assert.deepEqual(validatePackage({ root, runtimeManifest }).errors, [])
})

test('reports parameters that drift from a runtime input schema', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	const runtimeManifest = writeManifest(root, [{
		name: 'bricks/do-thing',
		input_schema: {
			type: 'object',
			required: ['id'],
			properties: { id: { type: 'integer' } },
			additionalProperties: false
		}
	}])
	fs.writeFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), `---\nname: bricks-example\ndescription: Example\n---\n\n\`\`\`json\n{ "ability_name": "bricks/do-thing", "parameters": { "id": "wrong", "extra": true } }\n\`\`\`\n`)
	const errors = validatePackage({ root, runtimeManifest }).errors
	assert(errors.some((error) => error.includes('parameters.id must be integer')))
	assert(errors.some((error) => error.includes('parameters.extra is not allowed')))
})

test('extracts literal and bounded loop-generated abilities from a Bricks checkout', (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bricks-source-validator-'))
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.mkdirSync(path.join(root, 'includes/abilities'), { recursive: true })
	fs.writeFileSync(path.join(root, 'includes/abilities/manager.php'), `<?php\n$this->register( 'bricks/literal', [] );\nforeach ( [ 'apply' => 'Apply', 'resume' => 'Resume' ] as $callback => $verb ) {\n\t\t\t$this->register( 'bricks/' . $callback . '-change', [] );\n\t\t}\n`)
	assert.deepEqual([...abilitiesFromSource(root).keys()], ['bricks/apply-change', 'bricks/literal', 'bricks/resume-change'])
})

test('compares every pinned input schema digest with an exact Bricks source checkout', (t) => {
	const packageRoot = makePackage()
	const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bricks-source-contract-'))
	t.after(() => fs.rmSync(packageRoot, { recursive: true, force: true }))
	t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }))
	fs.mkdirSync(path.join(sourceRoot, 'includes/abilities'), { recursive: true })
	fs.mkdirSync(path.join(sourceRoot, 'tests/unit/abilities/fixtures'), { recursive: true })
	fs.writeFileSync(path.join(sourceRoot, 'includes/abilities/manager.php'), "<?php\n$this->register( 'bricks/do-thing', [] );\n")
	fs.writeFileSync(path.join(sourceRoot, 'tests/unit/abilities/fixtures/registry-manifest.json'), JSON.stringify({
		'bricks/do-thing': { inputSchema: 'a'.repeat(64) }
	}))
	const runtimeManifest = writeManifest(packageRoot, [{ name: 'bricks/do-thing', inputSchemaDigest: 'b'.repeat(64) }])
	const errors = validatePackage({ root: packageRoot, runtimeManifest, bricksSource: sourceRoot }).errors
	assert(errors.some((error) => error.includes('input schema drifted from source for bricks/do-thing')))
})

test('complete runtime manifests require a schema digest for every ability', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	const manifest = path.join(root, 'runtime.json')
	fs.writeFileSync(manifest, JSON.stringify({
		generatedFrom: { inputSchemaDigests: 'complete' },
		abilities: [{ name: 'bricks/do-thing' }]
	}))
	const errors = validatePackage({ root, runtimeManifest: manifest }).errors
	assert(errors.some((error) => error.includes('bricks/do-thing has no input schema digest')))
})

test('embedded parameter schemas must match their pinned runtime digest', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	const manifest = writeManifest(root, [{
		name: 'bricks/do-thing',
		inputSchemaDigest: 'a'.repeat(64),
		input_schema: { type: 'object' }
	}])
	const errors = validatePackage({ root, runtimeManifest: manifest }).errors
	assert(errors.some((error) => error.includes('embedded input schema does not match its digest')))
})

test('workspace routing requires an explicit host capability', () => {
	const startHere = fs.readFileSync(path.join(repoRoot, 'skills/bricks-start-here/SKILL.md'), 'utf8')
	const repository = fs.readFileSync(path.join(repoRoot, 'skills/bricks-agent-repository/SKILL.md'), 'utf8')
	const frontmatter = parseFrontmatter(startHere)

	assert.match(frontmatter.description, /bricks\.workspace\/v1/)
	for (const source of [startHere, repository]) {
		assert.match(source, /explicitly announces?\s+(?:the\s+)?`?bricks\.workspace\/v1`?/i)
		assert.match(source, /Never infer `bricks\.workspace\/v1`/)
	}
	assert.match(repository, /Do not call resolve, commit, changeset, or focused mutation abilities/)
	assert.match(repository, /without claiming WordPress persistence/)
})

test('agent workflow skills retain their safety and completeness gates', () => {
	const reproduction = fs.readFileSync(path.join(repoRoot, 'skills/bricks-site-reproduction/SKILL.md'), 'utf8')
	const figma = fs.readFileSync(path.join(repoRoot, 'skills/bricks-figma-to-bricks/SKILL.md'), 'utf8')
	const audit = fs.readFileSync(path.join(repoRoot, 'skills/bricks-site-audit/SKILL.md'), 'utf8')
	const startHere = fs.readFileSync(path.join(repoRoot, 'skills/bricks-start-here/SKILL.md'), 'utf8')

	for (const field of ['code_sensitive_elements', 'code_sensitive_write_blocked', 'requires_execute_code']) {
		assert.match(reproduction, new RegExp(field))
	}
	assert.match(reproduction, /batch-create-global-classes[\s\S]*dryRun: true[\s\S]*dryRun: false/)
	assert.match(reproduction, /Preserve the[\s\S]*class IDs/i)
	assert.match(reproduction, /Bind tokens through a root theme style/)
	assert.match(figma, /Phase 2: Theme defaults/)
	assert.match(audit, /checkout-site-repository[\s\S]*nextCursor[\s\S]*hasMore/)
	assert.match(audit, /For every inventoried `postId`, call `bricks\/get-page-elements`/)
	assert.match(startHere, /exceptions are `bricks-commit-site-foundation`[\s\S]*`bricks\/commit-html-css-page-import`/)
	assert.match(startHere, /page importer does not create palettes, scales, theme styles, components, or templates/)
})
