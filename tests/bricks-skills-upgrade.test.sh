#!/usr/bin/env sh

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPGRADE="$ROOT/scripts/bricks-skills-upgrade"
UPDATE_CHECK="$ROOT/scripts/bricks-skills-update-check"
SEMVER_COMPARE="$ROOT/scripts/semver-compare"
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
"$REAL_GIT" -C "$SEED" tag v0.1.0-beta.9
printf '%s\n' 'main has moved beyond the release tag' > "$SEED/post-release-note.txt"
"$REAL_GIT" -C "$SEED" add post-release-note.txt
"$REAL_GIT" -C "$SEED" commit -m post-release >/dev/null
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

run_equal_version_pins_release_test() {
	checkout="$TMP_ROOT/equal-version"
	state="$TMP_ROOT/equal-version-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2)"
	assert_contains "$output" 'BRICKS_SKILLS_PINNED 0.1.0-beta.2 v0.1.0-beta.2'
	assert_equals "$("$REAL_GIT" -C "$checkout" rev-parse HEAD)" "$("$REAL_GIT" -C "$checkout" rev-list -n 1 v0.1.0-beta.2)"
	if "$REAL_GIT" -C "$checkout" symbolic-ref -q HEAD >/dev/null 2>&1; then
		echo 'Equal-version upgrade did not detach the release checkout' >&2
		exit 1
	fi
	if [ -e "$checkout/post-release-note.txt" ]; then
		echo 'Equal-version upgrade left files from main outside the release tag' >&2
		exit 1
	fi
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2)"
	assert_contains "$output" 'BRICKS_SKILLS_ALREADY_CURRENT 0.1.0-beta.2 v0.1.0-beta.2'
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

run_semver_compare_test() {
	assert_equals "$(sh "$SEMVER_COMPARE" 0.1.0-beta.2 0.1.0-beta.1)" '1'
	assert_equals "$(sh "$SEMVER_COMPARE" 0.1.0-beta.2 0.1.0-beta.10)" '-1'
	assert_equals "$(sh "$SEMVER_COMPARE" 0.1.0 0.1.0-beta.10)" '1'
	assert_equals "$(sh "$SEMVER_COMPARE" 1.2.3+local 1.2.3+remote)" '0'
	assert_equals "$(sh "$SEMVER_COMPARE" 999999999999999999999.0.0 999999999999999999998.0.0)" '1'
	assert_equals "$(sh "$SEMVER_COMPARE" 1.2.3-999999999999999999999 1.2.3-999999999999999999998)" '1'
	assert_equals "$(LC_ALL=en_US.UTF-8 sh "$SEMVER_COMPARE" 1.0.0-Z 1.0.0-alpha)" '-1'
	assert_equals "$(LC_ALL=en_US.UTF-8 sh "$SEMVER_COMPARE" 1.0.0-alpha 1.0.0-Z)" '1'
	for invalid in 01.2.3 1.02.3 1.2.03 1.2.3-01 1.2.3- 1.2.3+ 1.2.3++x; do
		if sh "$SEMVER_COMPARE" "$invalid" 1.2.3 >/dev/null 2>&1; then
			echo "Invalid semantic version was accepted: $invalid" >&2
			exit 1
		fi
	done
}

run_update_check_downgrade_test() {
	checkout="$TMP_ROOT/update-check-newer-local"
	state="$TMP_ROOT/update-check-newer-local-state"
	releases="$TMP_ROOT/older-releases.json"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	printf '%s\n' '[{"tag_name":"v0.1.0-beta.1"}]' > "$releases"

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" BRICKS_SKILLS_RELEASES_API_URL="file://$releases" sh "$UPDATE_CHECK" --force)"
	assert_equals "$output" ''
	assert_contains "$(cat "$state/last-update-check")" 'UP_TO_DATE 0.1.0-beta.2 v0.1.0-beta.1'
}

run_update_check_failure_and_arguments_test() {
	checkout="$TMP_ROOT/update-check-failure"
	state="$TMP_ROOT/update-check-failure-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" BRICKS_SKILLS_RELEASES_API_URL="file://$TMP_ROOT/missing-releases.json" sh "$UPDATE_CHECK" --force)"
	assert_equals "$output" 'BRICKS_SKILLS_UPDATE_CHECK_FAILED 0.1.0-beta.2'
	if [ -e "$state/last-update-check" ]; then
		echo 'Failed update check unexpectedly populated the cache' >&2
		exit 1
	fi

	set +e
	BRICKS_SKILLS_UPDATE_CHECK=false BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPDATE_CHECK" --bogus extra >/dev/null 2>&1
		status=$?
	set -e
	assert_equals "$status" '2'

	malformed="$TMP_ROOT/malformed-releases.json"
	printf '%s\n' '[{"tag_name":"release-latest"}]' > "$malformed"
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/malformed-state" BRICKS_SKILLS_RELEASES_API_URL="file://$malformed" sh "$UPDATE_CHECK" --force)"
	assert_equals "$output" 'BRICKS_SKILLS_UPDATE_CHECK_FAILED 0.1.0-beta.2'
	if [ -e "$TMP_ROOT/malformed-state/last-update-check" ]; then
		echo 'Malformed update response unexpectedly populated the cache' >&2
		exit 1
	fi

	broken="$TMP_ROOT/broken-releases.json"
	printf '%s\n' '[{"tag_name":"v0.1.0-beta.3" BROKEN]' > "$broken"
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/broken-state" BRICKS_SKILLS_RELEASES_API_URL="file://$broken" sh "$UPDATE_CHECK" --force)"
	assert_equals "$output" 'BRICKS_SKILLS_UPDATE_CHECK_FAILED 0.1.0-beta.2'
	if [ -e "$TMP_ROOT/broken-state/last-update-check" ]; then
		echo 'Invalid JSON update response unexpectedly populated the cache' >&2
		exit 1
	fi

	empty="$TMP_ROOT/empty-releases.json"
	printf '%s\n' '[]' > "$empty"
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/empty-state" BRICKS_SKILLS_RELEASES_API_URL="file://$empty" sh "$UPDATE_CHECK" --force)"
	assert_equals "$output" ''
	assert_contains "$(cat "$TMP_ROOT/empty-state/last-update-check")" 'UP_TO_DATE 0.1.0-beta.2 none'
}

run_downgrade_guard_test() {
	checkout="$TMP_ROOT/downgrade-guard"
	state="$TMP_ROOT/downgrade-guard-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1

	set +e
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.1 2>&1)"
	status=$?
	set -e

	assert_equals "$status" '6'
	assert_contains "$output" 'BRICKS_SKILLS_DOWNGRADE_REFUSED 0.1.0-beta.2 0.1.0-beta.1 v0.1.0-beta.1'
	assert_equals "$(cat "$checkout/VERSION")" '0.1.0-beta.2'
	assert_equals "$("$REAL_GIT" -C "$checkout" stash list)" ''

	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" --allow-downgrade v0.1.0-beta.1)"
	assert_contains "$output" 'BRICKS_SKILLS_UPDATED 0.1.0-beta.2 0.1.0-beta.1 v0.1.0-beta.1'
	assert_equals "$(cat "$checkout/VERSION")" '0.1.0-beta.1'
}

run_failed_release_validation_preserves_worktree_test() {
	checkout="$TMP_ROOT/missing-tag"
	state="$TMP_ROOT/missing-tag-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1
	printf '%s\n' 'local edit' > "$checkout/local-note.txt"

	set +e
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.3 2>&1)"
	status=$?
	set -e

	assert_equals "$status" '4'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_TAG_NOT_FOUND v0.1.0-beta.3'
	assert_equals "$(cat "$checkout/local-note.txt")" 'local edit'
	assert_equals "$("$REAL_GIT" -C "$checkout" stash list)" ''
}

run_unverified_equal_older_and_mismatched_tag_test() {
	equal_checkout="$TMP_ROOT/missing-equal-tag"
	older_checkout="$TMP_ROOT/missing-older-tag"
	mismatch_checkout="$TMP_ROOT/mismatched-tag"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$equal_checkout" >/dev/null 2>&1
	printf '%s\n' '0.1.0-beta.3' > "$equal_checkout/VERSION"

	set +e
	output="$(BRICKS_SKILLS_DIR="$equal_checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/missing-equal-state" sh "$UPGRADE" v0.1.0-beta.3 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '4'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_TAG_NOT_FOUND v0.1.0-beta.3'
	assert_equals "$(cat "$equal_checkout/VERSION")" '0.1.0-beta.3'
	assert_equals "$("$REAL_GIT" -C "$equal_checkout" stash list)" ''

	"$REAL_GIT" clone --branch main "$ORIGIN" "$older_checkout" >/dev/null 2>&1
	set +e
	output="$(BRICKS_SKILLS_DIR="$older_checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/missing-older-state" sh "$UPGRADE" v0.1.0-beta.0 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '4'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_TAG_NOT_FOUND v0.1.0-beta.0'

	"$REAL_GIT" clone --branch main "$ORIGIN" "$mismatch_checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$mismatch_checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1
	set +e
	output="$(BRICKS_SKILLS_DIR="$mismatch_checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/mismatch-state" sh "$UPGRADE" v0.1.0-beta.9 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '4'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_VERSION_MISMATCH v0.1.0-beta.9 0.1.0-beta.2'
}

run_unpublished_local_tag_test() {
	checkout="$TMP_ROOT/unpublished-local-tag"
	state="$TMP_ROOT/unpublished-local-tag-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" config user.name "Bricks Skills Tests"
	"$REAL_GIT" -C "$checkout" config user.email "tests@example.com"
	printf '%s\n' '0.1.0-beta.3' > "$checkout/VERSION"
	"$REAL_GIT" -C "$checkout" commit -am local-beta.3 >/dev/null
	"$REAL_GIT" -C "$checkout" tag v0.1.0-beta.3

	set +e
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.3 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '4'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_TAG_NOT_FOUND v0.1.0-beta.3'
	assert_equals "$(cat "$checkout/VERSION")" '0.1.0-beta.3'
}

run_release_api_failure_test() {
	checkout="$TMP_ROOT/release-api-failure"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1

	set +e
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/release-api-failure-state" BRICKS_SKILLS_RELEASES_API_URL="file://$TMP_ROOT/missing-api.json" sh "$UPGRADE" 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '3'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_CHECK_FAILED'

	empty="$TMP_ROOT/no-releases.json"
	printf '%s\n' '[]' > "$empty"
	set +e
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/no-release-state" BRICKS_SKILLS_RELEASES_API_URL="file://$empty" sh "$UPGRADE" 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '3'
	assert_contains "$output" 'BRICKS_SKILLS_NO_RELEASE_FOUND'

	broken="$TMP_ROOT/broken-upgrade-releases.json"
	printf '%s\n' '[{"tag_name":"v0.1.0-beta.2" BROKEN]' > "$broken"
	set +e
	output="$(BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$TMP_ROOT/broken-upgrade-state" BRICKS_SKILLS_RELEASES_API_URL="file://$broken" sh "$UPGRADE" 2>&1)"
	status=$?
	set -e
	assert_equals "$status" '3'
	assert_contains "$output" 'BRICKS_SKILLS_RELEASE_CHECK_FAILED'
}

run_fetch_failure_preserves_worktree_test() {
	checkout="$TMP_ROOT/fetch-failure"
	state="$TMP_ROOT/fetch-failure-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" checkout --detach v0.1.0-beta.1 >/dev/null 2>&1
	"$REAL_GIT" -C "$checkout" remote set-url origin "$TMP_ROOT/does-not-exist.git"
	printf '%s\n' 'local edit' > "$checkout/local-note.txt"

	set +e
	BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2 >/dev/null 2>&1
	status=$?
	set -e

	if [ "$status" -eq 0 ]; then
		echo 'Fetch failure unexpectedly succeeded' >&2
		exit 1
	fi
	assert_equals "$(cat "$checkout/local-note.txt")" 'local edit'
	assert_equals "$("$REAL_GIT" -C "$checkout" stash list)" ''
}

run_extra_argument_test() {
	checkout="$TMP_ROOT/extra-argument"
	state="$TMP_ROOT/extra-argument-state"
	"$REAL_GIT" clone --branch main "$ORIGIN" "$checkout" >/dev/null 2>&1

	set +e
	BRICKS_SKILLS_DIR="$checkout" BRICKS_SKILLS_STATE_DIR="$state" sh "$UPGRADE" v0.1.0-beta.2 unexpected >/dev/null 2>&1
	status=$?
	set -e
	assert_equals "$status" '2'
}

run_semver_compare_test
run_clean_upgrade_test
run_equal_version_pins_release_test
run_dirty_upgrade_test
run_git_worktree_upgrade_test
run_stash_failure_test
run_incomplete_stash_test
run_update_check_downgrade_test
run_update_check_failure_and_arguments_test
run_downgrade_guard_test
run_failed_release_validation_preserves_worktree_test
run_unverified_equal_older_and_mismatched_tag_test
run_unpublished_local_tag_test
run_fetch_failure_preserves_worktree_test
run_release_api_failure_test
run_extra_argument_test

echo 'bricks-skills-upgrade tests passed.'
