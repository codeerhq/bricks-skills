#!/usr/bin/env python3
"""Aggregate grade.json files into a per-scenario, per-arm table."""
import json, pathlib, collections, statistics, sys
ROOT = pathlib.Path(__file__).parent
rows = [json.loads(p.read_text()) for p in sorted(ROOT.glob('runs/*/grade.json')) if 'smoke' not in p.parent.name]
model = sys.argv[1] if len(sys.argv) > 1 else None
by = collections.defaultdict(list)
for g in rows:
    if model and g['model'] != model:
        continue
    by[(g['scenario'], g['arm'])].append(g)
m = lambda xs: round(statistics.mean(xs), 2) if xs else None
print(f"{'scenario':14} {'arm':5} n  pass  lostRuns outScope  css   calls errs  secs   cost  out_tok  skills")
for (sc, arm), gs in sorted(by.items()):
    bools = [all(v for k, v in g['checks'].items() if isinstance(v, bool)) for g in gs]
    print(f"{sc:14} {arm:5} {len(gs)}  {sum(bools)}/{len(gs)}   {sum(1 for g in gs if g['lostUnrelated'])}/{len(gs)}     {sum(1 for g in gs if g['changedOutOfScope'])}/{len(gs)}   {m([g['customCssBytesDelta'] for g in gs]):>6} {m([g['toolCalls'] for g in gs]):>5} {m([g['toolErrors'] for g in gs]):>4} {m([g['seconds'] for g in gs]):>5} {m([g['cost'] for g in gs]):>6} {m([g['outputTokens'] for g in gs]):>7}  {sorted(set(s for g in gs for s in g['skills']))}")
    fails = collections.Counter(k for g in gs for k, v in g['checks'].items() if v is False)
    if fails:
        print(f"{'':20} failed checks: {dict(fails)}")
