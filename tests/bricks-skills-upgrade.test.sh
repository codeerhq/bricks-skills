#!/usr/bin/env sh

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPGRADE="$ROOT/scripts/bricks-skills-upgrade"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/bricks-skills-upgrade-test.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM

assert_contains() {
	haystack="$1"
	needle="$2"
	case "$haystack" in
		*"$needle"*) ;;
		*) echo "Expected output to contain: $needle" >&2; exit 1 ;;
	esac
}

assert_equals() {
	actual="$1"
	expected="$2"
	if [ "$actual" != "$expected" ]; then
		echo "Expected '$expected', got '$actual'" >&2
		exit 1
	fi
}

REAL_GIT="$(command -v git)"
ORIGIN="$TMP_ROOT/origin.git"
SEED="$TMP_ROOT/seed"

"$REAL_GIT" init --bare "$ORIGIN" >/dev/null
"$REAL_GIT" init "$SEED" >/dev/null
"$REAL_GIT" -C "$SEED" config user.name "Bricks Skills Tests"
"$REAL_GIT" -C "$SEED" config user.email "tests@example.com"
printf '%s\n' '0.1.0-beta.1' > "$SEED/VERSION"
"$REAL_GIT" -C "$SEED" add VERSION
"$REAL_GIT" -C "$SEED" commit -m beta.1 >/dev/null
"$REAL_GIT" -C "$SEED" tag v0.1.0-beta.1
printf '%s\n' '0.1.0-beta.2' > "$SEED/VERSION"
"$REAL_GIT" -C "$SEED" commit -am beta.2 >/dev/null
"$REAL_GIT" -C "$SEED" tag v0.1.0-beta.2
"$REAL_GIT" -C "$SEED" remote add origin "$ORIGIN"
"$REAL_GIT" -C "$SEED" push origin HEAD:main --tags >/dev/null

run_clean_upgrade_test() {
	checkout="$TMP_ROOT/clean"
	state="$TMP_ROOT/clean-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2)"
	assert_contains "$output" "BRICKS_SKILLS_UPDATED 0.1.0-beta.1 0.1.0-beta.2 v0.1.0-beta.2"
	case "$output" in
		*BRICKS_SKILLS_LOCAL_CHANGES_STASHED*) echo 'Clean upgrade unexpectedly reported a stash' >&2; exit 1 ;;
	esac
	assert_equals "$(cat "$checkout/VERSION")" '0.1.0-beta.2'
}

run_dirty_upgrade_test() {
	checkout="$TMP_ROOT/dirty"
	state="$TMP_ROOT/dirty-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1
	printf '%s\n' 'local edit' >> "$checkout/VERSION"
	printf '%s\n' 'untracked' > "$checkout/local-note.txt"

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2)"
	assert_contains "$output" 'BRICKS_SKILLS_LOCAL_CHANGES_STASHED'
	assert_equals "$(cat "$checkout/VERSION")" '0.1.0-beta.2'
	assert_equals "$("$REAL_GIT" -C "$checkout" status --porcelain)" ''
	assert_contains "$("$REAL_GIT" -C "$checkout" stash list)" 'bricks-skills-upgrade-'
}

run_git_worktree_upgrade_test() {
	checkout="$TMP_ROOT/git-worktree"
	state="$TMP_ROOT/git-worktree-state"
	"$REAL_GIT" -C "$SEED" worktree add --detach "$checkout" v0.1.0-beta.1 >/dev/null 2>&1

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2)"
	assert_contains "$output" "BRICKS_SKILLS_UPDATED 0.1.0-beta.1 0.1.0-beta.2 v0.1.0-beta.2"
	assert_equals "$(cat "$checkout/VERSION")" '0.1.0-beta.2'
}

run_stash_failure_test() {
	checkout="$TMP_ROOT/stash-failure"
	state="$TMP_ROOT/stash-failure-state"
	fake_bin="$TMP_ROOT/fake-bin"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1
	printf '%s\n' 'local edit' >> "$checkout/VERSION"
	mkdir -p "$fake_bin"
	printf '%s\n' '#!/usr/bin/env sh' 'if [ "${1:-}" = "stash" ]; then echo "injected stash failure" >&2; exit 99; fi' 'exec "$REAL_GIT" "$@"' > "$fake_bin/git"
	chmod +x "$fake_bin/git"

	set +e
	output="$(PATH="$fake_bin:$PATH" REAL_GIT="$REAL_GIT" BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2 2>&1)"
	status=$?
	set -e

	assert_equals "$status" '5'
	assert_contains "$output" 'BRICKS_SKILLS_STASH_FAILED'
	assert_contains "$(cat "$checkout/VERSION")" 'local edit'
	assert_equals "$("$REAL_GIT" -C "$checkout" rev-parse HEAD)" "$("$REAL_GIT" -C "$checkout" rev-list -n 1 v0.1.0-beta.1)"
}

run_incomplete_stash_test() {
	checkout="$TMP_ROOT/incomplete-stash"
	state="$TMP_ROOT/incomplete-stash-state"
	fake_bin="$TMP_ROOT/incomplete-fake-bin"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1
	printf '%s\n' 'local edit' >> "$checkout/VERSION"
	mkdir -p "$fake_bin"
	printf '%s\n' '#!/usr/bin/env sh' 'if [ "${1:-}" = "stash" ]; then echo "pretended to stash"; exit 0; fi' 'exec "$REAL_GIT" "$@"' > "$fake_bin/git"
	chmod +x "$fake_bin/git"

	set +e
	output="$(PATH="$fake_bin:$PATH" REAL_GIT="$REAL_GIT" BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2 2>&1)"
	status=$?
	set -e

	assert_equals "$status" '5'
	assert_contains "$output" 'BRICKS_SKILLS_WORKTREE_NOT_CLEAN'
	assert_contains "$(cat "$checkout/VERSION")" 'local edit'
	assert_equals "$("$REAL_GIT" -C "$checkout" rev-parse HEAD)" "$("$REAL_GIT" -C "$checkout" rev-list -n 1 v0.1.0-beta.1)"
}

run_clean_upgrade_test
run_dirty_upgrade_test
run_git_worktree_upgrade_test
run_stash_failure_test
run_incomplete_stash_test

echo 'bricks-skills-upgrade tests passed.'
