import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const fixture = JSON.parse(fs.readFileSync(new URL('../skills/bricks-nestable-elements/assets/tabs-nested.json', import.meta.url)))
const schema = (name) => JSON.parse(fs.readFileSync(new URL(`../skills/bricks-element-schemas/references/schema-resolved/elements/${name}.json`, import.meta.url)))

test('native Tabs recipe uses valid nested element and setting shapes', () => {
  const inspect = (element) => {
    const definition = schema(element.name)
    if (element.children?.length) assert.equal(definition.metadata.nestable, true)
    for (const [key, value] of Object.entries(element.settings ?? {})) {
      if (key === '_hidden') {
        // Runtime virtual setting; not part of the generated public control bundle.
        assert.deepEqual(Object.keys(value), ['_cssClasses'])
        assert.equal(typeof value._cssClasses, 'string')
        continue
      }
      const rule = definition.settings[key]?.valueSchema
      assert.ok(rule, `${element.name}.${key} has a bundled value contract`)
      assert.equal(rule.type, 'string')
      assert.equal(typeof value, 'string')
      if (rule.enum) assert.ok(rule.enum.includes(value))
    }
    for (const child of element.children ?? []) inspect(child)
  }
  inspect(fixture)
})

test('native Tabs recipe retains selector relationships and matching title/pane order', () => {
  const css = (element) => element.settings?._hidden?._cssClasses
  assert.equal(fixture.name, 'tabs-nested')
  const [menu, content] = fixture.children
  assert.equal(fixture.children.length, 2)
  assert.equal(css(menu), 'tab-menu')
  assert.equal(css(content), 'tab-content')
  assert.equal(menu.children.length, content.children.length)
  assert.ok(menu.children.length >= 2)
  for (const title of menu.children) assert.equal(css(title), 'tab-title')
  for (const pane of content.children) {
    assert.equal(css(pane), 'tab-pane')
    assert.ok(pane.children.length)
  }
  assert.equal(fixture.settings.openTab, '0')
})
