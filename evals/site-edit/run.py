#!/usr/bin/env python3
"""Run one multi-turn session against a lab worker with a stock headless client.

Usage: run.py <arm> <scenario> <rep> [--model sonnet] [--client claude|codex]

No system prompt is supplied and the brief is passed verbatim. Skills are real
project skills. The only tools are the site's MCP server, Skill and Read.
State is snapshotted after every turn for grading.
"""
import argparse, json, os, pathlib, shutil, subprocess, sys, time, urllib.request

ROOT = pathlib.Path(__file__).parent
CFG = json.loads((ROOT / 'arms.json').read_text())

ap = argparse.ArgumentParser()
ap.add_argument('arm'); ap.add_argument('scenario'); ap.add_argument('rep')
ap.add_argument('--model', default='sonnet')
ap.add_argument('--client', default='claude', choices=['claude', 'codex'])
a = ap.parse_args()

arm = CFG[a.arm]
scenario = json.loads((ROOT / 'scenarios.json').read_text())[a.scenario]
runid = f"{a.scenario}-{a.arm}-{a.model}-{a.rep}"
out = ROOT / 'runs' / runid
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)


def lab(*args, stdin=None):
    return subprocess.run(['docker', 'exec', '-i', arm['cli'], *args], input=stdin, text=True, capture_output=True)


def snapshot(name):
    p = lab('wp', 'eval-file', '/tmp/harness/snapshot.php')
    (out / f'state-{name}.json').write_text(p.stdout if p.returncode == 0 else json.dumps({'error': p.stderr[-2000:]}))
    pages = {}
    for path in ['/', '/about/', '/services/', '/projects/', '/work/', '/journal/', '/contact/']:
        try:
            pages[path] = urllib.request.urlopen(arm['siteUrl'] + path, timeout=30).read().decode('utf-8', 'replace')
        except Exception as e:  # a 404 is data too
            pages[path] = 'ERROR ' + str(e)
    (out / f'html-{name}.json').write_text(json.dumps(pages))


# Reset to the fixture, then apply any scenario-specific setup.
r = lab('bash', '/tmp/harness/reset.sh')
if r.returncode != 0:
    sys.exit('reset failed: ' + r.stderr[-1500:])
snapshot('before')

# A clean project: only the arm's skills pack, no user settings or memory.
CONTEXT = "The user's WordPress site, built with Bricks, is connected through the bricks MCP server. Their requests are about that site."
CODEX = os.environ.get('CODEX_BIN', 'codex')
proj = out / 'project'
skills_dir = proj / ('.claude' if a.client == 'claude' else '.agents')
skills_dir.mkdir(parents=True)
if arm.get('skills'):
    shutil.copytree(arm['skills'], skills_dir / 'skills')
if a.client == 'codex':
    (proj / 'AGENTS.md').write_text(CONTEXT + '\n')


def codex_turn(say, session):
    """Run one Codex turn and return (claude-style transcript lines, result dict)."""
    # Options go before `resume`: the subcommand accepts only a subset of them.
    cmd = [CODEX, 'exec', '--ignore-user-config', '--skip-git-repo-check', '--json', '--approve-for-me', '-C', str(proj)]
    if a.model != 'default':
        cmd += ['-m', a.model]
    cmd += ['-c', f'mcp_servers.bricks.url="{arm["mcpUrl"]}"', '-c', 'mcp_servers.bricks.http_headers={Authorization="' + arm['authorization'] + '"}']
    cmd += ['resume', session, say] if session else [say]
    p = subprocess.run(cmd, cwd=proj, text=True, capture_output=True, timeout=2400, stdin=subprocess.DEVNULL)
    lines, result = [], {'session_id': session, 'is_error': p.returncode != 0, 'usage': {}, 'total_cost_usd': None, 'num_turns': 0}
    for line in p.stdout.splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        it = d.get('item') or {}
        if d.get('type') == 'thread.started':
            result['session_id'] = d.get('thread_id')
        if d.get('type') == 'item.completed' and it.get('type') == 'mcp_tool_call':
            result['num_turns'] += 1
            lines.append(json.dumps({'message': {'content': [{'type': 'tool_use', 'name': 'mcp__bricks__' + str(it.get('tool')), 'input': it.get('arguments') or {}}]}}))
            lines.append(json.dumps({'message': {'content': [{'type': 'tool_result', 'is_error': it.get('status') != 'completed', 'content': it.get('result') or it.get('error')}]}}))
        if d.get('type') == 'item.completed' and it.get('type') == 'command_execution':
            lines.append(json.dumps({'message': {'content': [{'type': 'tool_use', 'name': 'Shell', 'input': {'command': str(it.get('command'))[:300]}}]}}))
        if it.get('type') == 'agent_message':
            result['result'] = it.get('text')
        if d.get('type') == 'turn.completed':
            u = d.get('usage') or {}
            result['usage'] = {'input_tokens': u.get('input_tokens'), 'cached_input_tokens': u.get('cached_input_tokens'), 'output_tokens': u.get('output_tokens', 0)}
    return p, lines, result
mcp = out / 'mcp.json'
mcp.write_text(json.dumps({'mcpServers': {'bricks': {'type': 'http', 'url': arm['mcpUrl'], 'headers': {'Authorization': arm['authorization']}}}}))
mcp.chmod(0o600)

session = None
turns = []
for i, turn in enumerate(scenario['turns']):
    if turn.get('before'):
        b = lab('wp', 'eval', turn['before'])
        if b.returncode != 0:
            sys.exit('turn setup failed: ' + b.stderr[-1500:])
    cmd = ['claude', '-p', turn['say'], '--model', a.model,
           '--mcp-config', str(mcp), '--strict-mcp-config',
           '--setting-sources', 'project',
           '--allowedTools', 'mcp__bricks__*', 'Skill', 'Read',
           '--disallowedTools', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Agent', 'NotebookEdit',
           # States the setup a connected client already implies; says nothing about how to work.
           '--append-system-prompt', "The user's WordPress site, built with Bricks, is connected through the bricks MCP server. Their requests are about that site.",
           '--permission-mode', 'dontAsk',
           '--output-format', 'stream-json', '--verbose']
    if session:
        cmd += ['--resume', session]
    start = time.monotonic()
    if a.client == 'codex':
        p, lines, result = codex_turn(turn['say'], session)
        (out / f'turn-{i}.jsonl').write_text('\n'.join(lines))
        (out / f'turn-{i}.raw.jsonl').write_text(p.stdout)
    else:
        p = subprocess.run(cmd, cwd=proj, text=True, capture_output=True, timeout=2400, stdin=subprocess.DEVNULL)
        (out / f'turn-{i}.jsonl').write_text(p.stdout)
        result = {}
        for line in p.stdout.splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get('type') == 'result':
                result = d
    session = result.get('session_id', session)
    turns.append({
        'turn': i, 'seconds': round(time.monotonic() - start, 1), 'exit': p.returncode,
        'cost': result.get('total_cost_usd'), 'numTurns': result.get('num_turns'),
        'usage': result.get('usage'), 'isError': result.get('is_error'),
        'reply': result.get('result'), 'stderr': p.stderr[-800:] if p.returncode else ''
    })
    snapshot(f'after-{i}')

(out / 'summary.json').write_text(json.dumps({'runid': runid, 'arm': a.arm, 'scenario': a.scenario, 'model': a.model, 'turns': turns}, indent=1))
print(json.dumps({'runid': runid, 'cost': sum(t['cost'] or 0 for t in turns), 'seconds': sum(t['seconds'] for t in turns), 'errors': [t['turn'] for t in turns if t['exit'] or t['isError']]}))
