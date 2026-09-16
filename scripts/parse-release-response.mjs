#!/usr/bin/env node

import process from 'node:process'

let response = ''
for await (const chunk of process.stdin) {
	response += chunk
}

let releases
try {
	releases = JSON.parse(response)
} catch {
	process.exit(3)
}

// GitHub /releases/latest returns one object, unlike the prerelease list endpoint.
if (releases && !Array.isArray(releases) && typeof releases.tag_name === 'string') {
	releases = [releases]
}
if (!Array.isArray(releases)) {
	process.exit(3)
}
// Stable installations stay on stable releases. Installing an explicit prerelease
// opts that checkout into prerelease discovery until it reaches a stable version.
const installedVersion = (process.argv[2] ?? '').replace(/^v/, '')
const includePrereleases = /^\d+\.\d+\.\d+-/.test(installedVersion)
const eligible = []
for (const release of releases) {
	if (!release || typeof release !== 'object' || typeof release.tag_name !== 'string' || release.tag_name.trim() === '') {
		process.exit(3)
	}
	if (release.draft === true) continue
	const tag = release.tag_name.trim()
	if (!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag)) process.exit(3)
	const prerelease = release.prerelease === true || /^v?\d+\.\d+\.\d+-/.test(tag)
	if (includePrereleases || !prerelease) eligible.push(tag)
}
if (eligible.length === 0) {
	process.exit(2)
}
process.stdout.write(eligible[0])
