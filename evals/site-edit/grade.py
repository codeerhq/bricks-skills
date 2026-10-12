#!/usr/bin/env python3
"""Deterministic grading of one run from its state snapshots and transcripts.

Usage: grade.py <run-dir>   (writes grade.json, prints one summary line)

Everything here is computed from saved data, never from the agent's reply.
"""
import json, pathlib, re, sys, collections

run = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).parent
summary = json.loads((run / 'summary.json').read_text())
scenario = json.loads((ROOT / 'scenarios.json').read_text())[summary['scenario']]
CONTENT = ('_bricks_page_content_2', '_bricks_page_header_2', '_bricks_page_footer_2')


def load(name):
    return json.loads((run / f'state-{name}.json').read_text())


def trees(state):
    """{(postTitle, metaKey): {elementId: element}}"""
    out = {}
    for p in state['posts']:
        for k in CONTENT:
            els = p['meta'].get(k)
            if isinstance(els, list):
                out[(p['title'], k)] = {str(e.get('id')): e for e in els if isinstance(e, dict)}
    return out


def blob(state):
    return json.dumps({'posts': state['posts'], 'options': state['options']}, ensure_ascii=False)


def css_bytes(state):
    n = 0
    for t in trees(state).values():
        for e in t.values():
            s = e.get('settings') or {}
            n += len(s.get('_cssCustom') or '') if isinstance(s, dict) else 0
            if e.get('name') == 'code':
                n += len(json.dumps(s))
    for c in state['options'].get('bricks_global_classes') or []:
        n += len((c.get('settings') or {}).get('_cssCustom') or '') if isinstance(c.get('settings'), dict) else 0
    g = state['options'].get('bricks_global_settings') or {}
    n += len(g.get('customCss') or '')
    for p in state['posts']:
        ps = p['meta'].get('_bricks_page_settings')
        if isinstance(ps, dict):
            n += len(ps.get('customCss') or '')
    return n


def text_of(e):
    s = e.get('settings') or {}
    if not isinstance(s, dict):
        return ''
    return re.sub(r'<[^>]+>', '', str(s.get('text') or s.get('title') or ''))[:70]


before = load('before')
last = len(summary['turns']) - 1
after = load(f'after-{last}')
bt, at = trees(before), trees(after)
allowed = [re.compile(x, re.I) for x in scenario.get('mayRemove', [])]
scope = [re.compile(x, re.I) for x in scenario.get('scopePages', ['.*'])]

lost, lost_allowed, changed_out_of_scope, lost_roots = [], [], [], []
for key, els in bt.items():
    now = at.get(key, {})
    in_scope = any(r.search(key[0]) for r in scope)
    gone = {eid for eid in els if eid not in now}
    for eid, e in els.items():
        if eid in now and not in_scope and json.dumps(e, sort_keys=True) != json.dumps(now[eid], sort_keys=True):
            changed_out_of_scope.append({'page': key[0], 'id': eid, 'name': e.get('name')})
    # Group dropped elements into subtrees; a subtree is allowed when any text inside it matches.
    for root in [eid for eid in gone if str(els[eid].get('parent')) not in gone]:
        members, stack = [], [root]
        while stack:
            cur = stack.pop()
            members.append(cur)
            stack += [x for x in gone if str(els[x].get('parent')) == cur]
        text = ' | '.join(filter(None, (text_of(els[m]) + ' ' + str(els[m].get('label') or '') for m in members)))
        rows = [{'page': key[0], 'id': m, 'name': els[m].get('name'), 'text': text_of(els[m])} for m in members]
        if any(r.search(text) for r in allowed) or all(els[m].get('name') in scenario.get('mayRemoveNames', []) for m in members):
            lost_allowed += rows
        else:
            lost += rows
            lost_roots.append({'page': key[0], 'id': root, 'name': els[root].get('name'), 'size': len(members), 'text': text[:140]})

tools, errors, skills = collections.Counter(), 0, []
for i in range(last + 1):
    f = run / f'turn-{i}.jsonl'
    if not f.exists():
        continue
    for line in f.read_text().splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        msg = d.get('message') or {}
        for b in msg.get('content') or [] if isinstance(msg.get('content'), list) else []:
            if b.get('type') == 'tool_use':
                n = b['name'].replace('mcp__bricks__', '')
                if n.endswith('execute-ability'):
                    n = 'exec:' + str((b.get('input') or {}).get('ability_name'))
                if n == 'Skill':
                    skills.append(str((b.get('input') or {}).get('skill')))
                tools[n] += 1
            if b.get('type') == 'tool_result':
                body = json.dumps(b.get('content'))
                if b.get('is_error') or re.search(r'\\"code\\":\s*\\"bricks_|"isError":\s*true|bricks_(invalid|conflict|forbidden|not_found)', body):
                    errors += 1

B, A = blob(before), blob(after)
checks = {}
for c in scenario.get('checks', []):
    kind = c['kind']
    if kind == 'absent':
        checks[c['name']] = len(re.findall(c['pattern'], A, re.I)) == 0
    elif kind == 'present':
        checks[c['name']] = len(re.findall(c['pattern'], A, re.I)) >= c.get('min', 1)
    elif kind == 'loop':
        checks[c['name']] = any(isinstance(e.get('settings'), dict) and e['settings'].get('hasLoop') and c['pattern'] in json.dumps(e['settings'].get('query'))
                                 for k, t in at.items() if re.search(c['page'], k[0], re.I) for e in t.values())
    elif kind == 'element':
        checks[c['name']] = any(re.search(c['pattern'], str(e.get('name')))
                                 for k, t in at.items() if re.search(c['page'], k[0], re.I) for e in t.values())
    elif kind == 'filterIndex':
        checks[c['name']] = (after['filters'].get('index') or 0) > 0
    elif kind == 'unchangedText':
        checks[c['name']] = c['pattern'] in A
    elif kind == 'count':
        checks[c['name'] + ':n'] = len(re.findall(c['pattern'], A, re.I))

bc = {c.get('id'): c for c in before['options'].get('bricks_global_classes') or []}
ac = {c.get('id'): c for c in after['options'].get('bricks_global_classes') or []}
grade = {
    'runid': summary['runid'], 'arm': summary['arm'], 'scenario': summary['scenario'], 'model': summary['model'],
    'cost': round(sum(t['cost'] or 0 for t in summary['turns']), 3),
    'seconds': round(sum(t['seconds'] for t in summary['turns'])),
    'outputTokens': sum((t['usage'] or {}).get('output_tokens', 0) for t in summary['turns']),
    'harnessError': any(t['exit'] or t['isError'] for t in summary['turns']),
    'toolCalls': sum(tools.values()), 'toolErrors': errors, 'skills': skills, 'tools': dict(tools.most_common()),
    'lostUnrelated': len(lost), 'lostUnrelatedSubtrees': lost_roots[:12], 'lostAllowed': len(lost_allowed),
    'changedOutOfScope': len(changed_out_of_scope), 'changedOutOfScopeSample': changed_out_of_scope[:8],
    'customCssBytesDelta': css_bytes(after) - css_bytes(before),
    'classesAdded': sorted(str(ac[i].get('name')) for i in ac.keys() - bc.keys()),
    'classesRemoved': sorted(str(bc[i].get('name')) for i in bc.keys() - ac.keys()),
    'classesChanged': sum(1 for i in ac.keys() & bc.keys() if ac[i] != bc[i]),
    'themeStylesChanged': before['options'].get('bricks_theme_styles') != after['options'].get('bricks_theme_styles'),
    'filters': after['filters'], 'checks': checks,
}
(run / 'grade.json').write_text(json.dumps(grade, indent=1))
print(json.dumps({k: grade[k] for k in ('runid', 'cost', 'seconds', 'toolCalls', 'toolErrors', 'lostUnrelated', 'changedOutOfScope', 'customCssBytesDelta', 'checks')}))
