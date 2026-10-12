#!/usr/bin/env python3
"""Blind review of one run: what would the site owner still have to ask for?

Usage: judge.py <run-dir>   (writes judge.json)

The reviewer sees the owner's messages and the saved before/after site data.
It is not told which arm produced the run and has no tools.
"""
import json, pathlib, re, subprocess, sys, html

run = pathlib.Path(sys.argv[1])
summary = json.loads((run / 'summary.json').read_text())
last = len(summary['turns']) - 1
before = json.loads((run / 'state-before.json').read_text())
after = json.loads((run / f'state-after-{last}.json').read_text())
CONTENT = ('_bricks_page_content_2', '_bricks_page_header_2', '_bricks_page_footer_2')
scenarios = json.loads((pathlib.Path(__file__).parent / 'scenarios.json').read_text())
says = [t['say'] for t in scenarios[summary['scenario']]['turns']]


def trees(state):
    out = {}
    for p in state['posts']:
        for k in CONTENT:
            els = p['meta'].get(k)
            if isinstance(els, list):
                out[p['title']] = {str(e.get('id')): e for e in els if isinstance(e, dict)}
    return out


def short(e):
    return json.dumps({k: e.get(k) for k in ('id', 'name', 'parent', 'label', 'settings')}, ensure_ascii=False)[:900]


lines = []
bt, at = trees(before), trees(after)
for title in sorted(set(bt) | set(at)):
    b, a = bt.get(title, {}), at.get(title, {})
    added = [a[i] for i in a if i not in b]
    removed = [b[i] for i in b if i not in a]
    changed = [(b[i], a[i]) for i in a if i in b and a[i] != b[i]]
    if not (added or removed or changed):
        continue
    lines.append(f'## {title}: {len(b)} elements before, {len(a)} after')
    lines += ['ADDED ' + short(e) for e in added[:40]]
    lines += ['REMOVED ' + short(e) for e in removed[:40]]
    for x, y in changed[:40]:
        lines.append('CHANGED from ' + short(x) + '\n        to   ' + short(y))
for key, label in (('bricks_global_classes', 'Global classes'), ('bricks_global_variables', 'Global variables')):
    b = {c.get('id'): c for c in before['options'].get(key) or []}
    a = {c.get('id'): c for c in after['options'].get(key) or []}
    diff = [f'ADDED {json.dumps(a[i])[:600]}' for i in a if i not in b] + [f'REMOVED {json.dumps(b[i])[:300]}' for i in b if i not in a] + \
           [f'CHANGED from {json.dumps(b[i])[:600]}\n        to   {json.dumps(a[i])[:600]}' for i in a if i in b and a[i] != b[i]]
    if diff:
        lines += [f'## {label}'] + diff[:40]
for key, label in (('bricks_theme_styles', 'Theme styles'), ('bricks_color_palette', 'Color palette'), ('bricks_components', 'Components')):
    if before['options'].get(key) != after['options'].get(key):
        lines += [f'## {label} changed', 'before: ' + json.dumps(before['options'].get(key))[:2500], 'after:  ' + json.dumps(after['options'].get(key))[:2500]]
gb, ga = (before['options'].get('bricks_global_settings') or {}), (after['options'].get('bricks_global_settings') or {})
if gb != ga:
    lines += ['## Global settings changed'] + [f'{k}: {json.dumps(gb.get(k))[:500]} -> {json.dumps(ga.get(k))[:1500]}' for k in sorted(set(gb) | set(ga)) if gb.get(k) != ga.get(k)]
if before['filters'] != after['filters']:
    lines.append(f"## Query filter tables: {before['filters']} -> {after['filters']}")
if before.get('menus') != after.get('menus'):
    lines.append('## Menus changed: ' + json.dumps(after.get('menus'))[:800])

pages = json.loads((run / f'html-after-{last}.json').read_text())
before_pages = json.loads((run / 'html-before.json').read_text())


def text(h):
    h = re.sub(r'<(script|style)[\s\S]*?</\1>', '', h)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()


rendered = [f'### {path}\n{text(h)[:2500]}' for path, h in pages.items() if text(h) != text(before_pages.get(path, ''))]

prompt = f"""You are an experienced Bricks Builder professional reviewing work an AI assistant did on a small business owner's existing WordPress site. The owner is not technical.

The owner's messages, in order:
{json.dumps(says, indent=1)}

The assistant's final reply to the owner:
{(summary['turns'][-1]['reply'] or '')[:2500]}

What actually changed in the saved Bricks data (everything not listed is unchanged):
{chr(10).join(lines)[:60000] or '(nothing changed)'}

Rendered text of pages whose visible text changed:
{chr(10).join(rendered)[:15000] or '(no visible text changed)'}

List the follow-up corrections this owner, or a Bricks professional they later hire, would have to ask for. Count only real problems:
- the request not done, half done, or done wrongly; things the reply claims that the data does not show
- unrelated content or styling damaged or removed
- work that will be hard to keep editing in the Builder: custom CSS or code where a normal control would do, the same styling repeated in many places instead of shared, content hardcoded where the site already has it as data, leftovers
Do not list taste preferences, optional extras, or the lack of browser testing. If the work is fine, return an empty list.

Reply with JSON only: {{"corrections": [{{"severity": "blocker|should|minor", "problem": "one sentence"}}], "summary": "one sentence"}}"""

p = subprocess.run(['claude', '-p', prompt, '--model', 'opus', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--output-format', 'json'],
                   text=True, capture_output=True, timeout=600, stdin=subprocess.DEVNULL, cwd='/tmp')
try:
    reply = json.loads(p.stdout).get('result', '')
    data = json.loads(re.search(r'\{[\s\S]*\}', reply).group(0))
except Exception as e:  # keep the raw reply for inspection
    data = {'error': str(e), 'raw': p.stdout[-1500:], 'stderr': p.stderr[-500:]}
(run / 'judge.json').write_text(json.dumps(data, indent=1))
c = data.get('corrections', [])
print(json.dumps({'run': run.name, 'blocker': sum(1 for x in c if x.get('severity') == 'blocker'), 'should': sum(1 for x in c if x.get('severity') == 'should'), 'minor': sum(1 for x in c if x.get('severity') == 'minor'), 'error': data.get('error')}))
