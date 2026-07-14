#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(root, 'skills')
const errors = []

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const fail = (message) => errors.push(message)

const walk = (directory) =>
	fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.name === '.git') {
			return []
		}

		const entryPath = path.join(directory, entry.name)
		return entry.isDirectory() ? walk(entryPath) : [entryPath]
	})

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

const skillDirectories = fs
	.readdirSync(skillsRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort()

for (const directory of skillDirectories) {
	const skillPath = path.join(skillsRoot, directory, 'SKILL.md')
	if (!fs.existsSync(skillPath)) {
		fail(`skills/${directory} has no SKILL.md`)
		continue
	}

	const contents = fs.readFileSync(skillPath, 'utf8')
	const frontmatterName = contents.match(/^---\n[\s\S]*?^name:\s*([^\n]+)$/m)?.[1]?.trim()
	const description = contents.match(/^---\n[\s\S]*?^description:\s*([^\n]+)$/m)?.[1]?.trim()
	if (frontmatterName !== directory) {
		fail(`skills/${directory}/SKILL.md name is ${frontmatterName ?? '<missing>'}`)
	}
	if (!description) {
		fail(`skills/${directory}/SKILL.md has no description`)
	}

	for (const alias of ['bricks-list-element-types', 'bricks-get-element-schema']) {
		if (contents.includes(alias)) {
			fail(`skills/${directory}/SKILL.md uses dispatcher-only direct-tool alias ${alias}`)
		}
	}

	if (directory !== 'bricks-import-export' && /(?:bricks\/)?(?:import-global-data|export-global-data|import-template-bundle|export-templates)/.test(contents)) {
		fail(`skills/${directory}/SKILL.md references a legacy transfer ability`)
	}
}

const manifestSkills = (marketplace?.plugins?.[0]?.skills ?? [])
	.map((skill) => skill.replace(/^\.\/skills\//, ''))
	.sort()

if (JSON.stringify(manifestSkills) !== JSON.stringify(skillDirectories)) {
	fail('marketplace skill list does not exactly match skills/ directories')
}

const readmeSkills = [...read('README.md').matchAll(/^\| \*\*(bricks-[^*]+)\*\* \|/gm)]
	.map((match) => match[1])
	.sort()

if (JSON.stringify(readmeSkills) !== JSON.stringify(skillDirectories)) {
	fail('README skill table does not exactly match skills/ directories')
}

if (errors.length > 0) {
	for (const error of errors) {
		console.error(`ERROR: ${error}`)
	}
	process.exit(1)
}

console.log(`Validated ${skillDirectories.length} skills for ${version}.`)
