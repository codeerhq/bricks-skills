import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const parser = new URL('../scripts/parse-release-response.mjs', import.meta.url)
const parse = (releases, version = '0.1.0') => spawnSync(process.execPath, [parser.pathname, version], {
  input: JSON.stringify(releases), encoding: 'utf8'
})

test('stable discovery excludes drafts, marked prereleases and prerelease tags', () => {
  const result = parse([
    { tag_name: 'v0.4.0', draft: true },
    { tag_name: 'v0.3.0', prerelease: true },
    { tag_name: 'v0.2.0-beta.1' },
    { tag_name: 'v0.1.1', prerelease: false }
  ])
  assert.equal(result.status, 0)
  assert.equal(result.stdout, 'v0.1.1')
})
test('prerelease installations can discover prereleases and graduate to stable', () => {
  assert.equal(parse([{ tag_name: 'v0.2.0-beta.2', prerelease: true }], '0.2.0-beta.1').stdout, 'v0.2.0-beta.2')
  assert.equal(parse([{ tag_name: 'v0.2.0', prerelease: false }], '0.2.0-beta.2').stdout, 'v0.2.0')
})
test('no eligible release is different from a malformed response', () => {
  assert.equal(parse([{ tag_name: 'v0.2.0-beta.1' }]).status, 2)
  assert.equal(parse([]).status, 2)
  assert.equal(parse({ message: 'unavailable' }).status, 3)
  assert.equal(parse([{ tag_name: 'release-latest' }]).status, 3)
  assert.equal(parse([{}]).status, 3)
})

test('accepts the stable latest endpoint object without accepting error objects', () => {
  assert.equal(parse({ tag_name: 'v0.1.1', draft: false, prerelease: false }).stdout, 'v0.1.1')
  assert.equal(parse({ message: 'Not Found' }).status, 3)
  assert.equal(parse({ tag_name: 'v0.2.0-beta.1', prerelease: true }).status, 2)
})

test('default discovery uses latest for stable and the release list for prerelease installs', async (t) => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bricks-release-endpoint-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const bin = path.join(root, 'bin')
  fs.mkdirSync(bin)
  const log = path.join(root, 'url')
  fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs')
const url = process.argv.at(-1)
fs.writeFileSync(process.env.BRICKS_TEST_FETCH_LOG, url)
if (process.env.BRICKS_TEST_FETCH_FAIL) process.exit(22)
const release = {tag_name:'v0.1.1',prerelease:false}
process.stdout.write(JSON.stringify(url.endsWith('/latest') ? release : [release]))
`, { mode: 0o755 })
  const checker = new URL('../scripts/bricks-skills-update-check', import.meta.url).pathname
  const run = (version, fail = false) => {
    fs.writeFileSync(path.join(root, 'VERSION'), `${version}\n`)
    const state = path.join(root, `state-${version}-${fail}`)
    const result = spawnSync('sh', [checker, '--force'], { encoding: 'utf8', env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, BRICKS_SKILLS_DIR: root,
      BRICKS_SKILLS_STATE_DIR: state, BRICKS_SKILLS_RELEASES_API_URL: '',
      BRICKS_SKILLS_UPDATE_CHECK: 'true', BRICKS_TEST_FETCH_LOG: log,
      BRICKS_TEST_FETCH_FAIL: fail ? '1' : ''
    } })
    return { ...result, url: fs.readFileSync(log, 'utf8'), state }
  }
  const stable = run('0.1.0')
  assert.equal(stable.status, 0)
  assert.equal(stable.url, 'https://api.github.com/repos/codeerhq/bricks-skills/releases/latest')
  assert.match(stable.stdout, /BRICKS_SKILLS_UPDATE_AVAILABLE 0\.1\.0 0\.1\.1 v0\.1\.1/)
  const beta = run('0.1.0-beta.1')
  assert.equal(beta.url, 'https://api.github.com/repos/codeerhq/bricks-skills/releases?per_page=20')
  assert.match(beta.stdout, /BRICKS_SKILLS_UPDATE_AVAILABLE/)
  const unavailable = run('0.1.0', true)
  assert.equal(unavailable.stdout.trim(), 'BRICKS_SKILLS_UPDATE_CHECK_FAILED 0.1.0')
  assert.equal(fs.existsSync(path.join(unavailable.state, 'last-update-check')), false)
})
