# Evaluate Bricks skills on task outcomes

Package validation checks distribution integrity. It does not measure whether an
agent chooses the right skill or completes a Bricks task correctly.

`cases.json` contains behavioral probes with supplied environments and observable
outcomes. These are evaluation specifications, not recorded passing runs or live
site fixtures. Keep expected outcomes out of the solver's prompt. Use them in a
separate grading pass.

## Paired protocol

Run the same task with the same model, client, permissions and fresh site fixture:

1. Bricks abilities without this pack.
2. The released/candidate pack.
3. The proposed revision.

Start from a clean fixture for each run and use multiple independent trials. Keep
held-out variants that were not used to author the skill: different target names,
class conventions, custom breakpoints, content providers and failure points. Include
adjacent requests that should not activate a broad build, audit or mutation workflow.
Do not tell the solver which skill to select unless testing explicit invocation.

Capture selected/read skills, tool arguments/results, final site state and user
interruptions. Grade preservation, requested effects, native editability, reference
integrity, truthful reporting and recovery. Record latency/tokens as secondary
metrics; a lower call count does not compensate for an incorrect or wider change.

Use deterministic state comparisons where possible. For example, a section
insertion must preserve old element IDs/settings/order, create only the intended
subtree, and resolve its class/component references. A successful mutation status or
revision number alone is not this evidence. Use independent visual/interaction
checks for behavior that cannot be established from saved data.

## Safe replay modes

- **Simulated forward test:** provide a realistic request and explicit raw tool
  observations to a fresh agent, with site writes disabled. Inspect its proposed
  next actions and evidence-qualified response. Do not score a proposed call as an
  executed successful mutation.
- **Runtime evaluation:** use a disposable/local or explicitly authorized staging
  fixture with known capabilities and owned data. Capture the actual ability trace,
  readback, Builder save/reload and frontend behavior relevant to the case. Use test
  sinks for forms/commerce. Never silently substitute a production site.

The lightweight automated checks currently run package validation, release-discovery
and upgrade behavior, and executable PHP recipe assertions. They are intentionally
separate from these model/runtime evaluations. Do not represent the scenario list
as automated runtime coverage.
