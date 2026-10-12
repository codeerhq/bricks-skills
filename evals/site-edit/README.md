# Site-edit evaluation

Runs ordinary owner requests against a lived-in Bricks site with a stock client,
then grades the saved site data. Use it to compare a baseline with a candidate
change to abilities or to this pack.

## What makes a run count

- **Briefs are what an owner types.** No hints about maintainability, native
  controls, preservation or which ability to use. If a brief states the thing
  being tested, the test measures reading, not judgement.
- **No coaching system prompt.** The only added context is one sentence saying
  the site is connected. Skills are installed the way the client installs them.
- **The site has history.** `fixture/owner-build-turns.json` is given to a stock
  agent, which builds the site through abilities. `fixture/overlay.php` then ages
  it: leftover classes, global CSS fixes, contact details repeated across pages.
  Features stay at their defaults (Query Filters is off). Fresh, pre-configured
  fixtures hid every product defect this set has found so far.
- **Grading reads saved data and rendered pages**, never the agent's reply.
- **A blind reviewer counts corrections.** `judge.py` shows a separate model the
  owner's messages and the before/after data, without the arm, and asks what the
  owner would still have to ask for.
- **Whoever writes a guidance change does not write the brief that tests it.**
  Add scenarios from real support requests and real sessions, not from the change.

## Setup

1. Start one disposable site per arm. Install `fixture/eval-studio-content.php`
   as a must-use plugin and run `fixture/seed-content.php`.
2. Build the site once by sending `fixture/owner-build-turns.json` to a stock
   agent on one site, run `fixture/overlay.php`, then copy that database to the
   other arms. Element IDs in `overlay.php` belong to the build it was written
   for; adjust them after a rebuild.
3. On each site, copy `container/` to `/tmp/harness/` in the WP-CLI container
   and export the fixture to `/tmp/harness/fixture.sql`. Every run restores it.
4. Copy `arms.example.json` to `arms.json` and fill in one entry per arm.

## Run

```bash
python3 run.py base email-service 1 --model sonnet
python3 grade.py runs/email-service-base-sonnet-1
python3 judge.py runs/email-service-base-sonnet-1
python3 summarize.py sonnet
```

`--client codex` runs the same brief through the Codex CLI (`CODEX_BIN`).

Run at least three repetitions per arm and scenario, and more than one model
family: clients route differently (one prefers focused element abilities, another
resolves and commits the whole file), so a change can help one and slow another.

## Reading results

Report hard failures (a check failed, content lost, the agent stopped on an
error) separately from reviewer corrections and from time and tokens. Reviewer
counts vary by about one correction per run between identical arms at three
repetitions; do not read smaller differences as an effect. Fewer tool calls is
not a result.

Not covered: Builder save and reload, browser interaction, visual quality,
custom element code, and sessions long enough to compact context.
