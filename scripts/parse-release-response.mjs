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

if (!Array.isArray(releases)) {
	process.exit(3)
}
if (releases.length === 0) {
	process.exit(2)
}
if (!releases[0] || typeof releases[0] !== 'object' || typeof releases[0].tag_name !== 'string' || releases[0].tag_name.trim() === '') {
	process.exit(3)
}

process.stdout.write(releases[0].tag_name)
