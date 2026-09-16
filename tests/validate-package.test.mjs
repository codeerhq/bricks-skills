import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { parseFrontmatter, parseSimpleYaml, validatePackage } from '../scripts/validate-package.mjs'

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
	fs.writeFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), `---\nname: bricks-example\ndescription: "Example package skill"\n---\n\nRead [the guide](references/guide.md).\n`)
	fs.writeFileSync(path.join(root, 'skills/bricks-example/agents/openai.yaml'), 'interface:\n  display_name: "Bricks example"\n  short_description: "Validate a Bricks example"\n  default_prompt: "Use the example skill."\n')
	return root
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

test('valid package accepts local references and metadata', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	assert.deepEqual(validatePackage({ root }).errors, [])
})

test('reports broken links, malformed metadata, invalid element IDs, and untracked package files', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.rmSync(path.join(root, 'skills/bricks-example/references/guide.md'))
	fs.writeFileSync(path.join(root, 'skills/bricks-example/agents/openai.yaml'), 'interface:\n  display_name: "Bricks example"\n  display_name: "Duplicate"\n')
	fs.writeFileSync(path.join(root, 'skills/bricks-example/SKILL.md'), `---\nname: bricks-example\ndescription: Example\n---\n\n[missing](references/guide.md)\n\nelementId: "too-long"\n`)
	const result = validatePackage({ root, trackedFiles: new Set() })
	assert(result.errors.some((error) => error.includes('missing local file')))
	assert(result.errors.some((error) => error.includes('duplicate YAML key')))
	assert(result.errors.some((error) => error.includes('invalid literal elementId too-long')))
	assert(result.errors.some((error) => error.includes('not tracked by git')))
	assert.equal(new Set(result.errors).size, result.errors.length)
})

test('validates local links in bundled Markdown references', (t) => {
	const root = makePackage()
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))
	fs.writeFileSync(path.join(root, 'skills/bricks-example/references/guide.md'), '[missing](other.md)\n')
	const errors = validatePackage({ root }).errors
	assert(errors.some((error) => error.includes('references/guide.md links to missing local file other.md')))
})
