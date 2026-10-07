#!/bin/bash
set -u
root=/Users/dylanxu/coding_tree
logs="$root/docs/validation/m12-02"
export PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
export OPENCODE_TEST_HOME=/private/tmp/m12-02-fix1-home
export XDG_DATA_HOME=/private/tmp/m12-02-fix1-data
export XDG_CONFIG_HOME=/private/tmp/m12-02-fix1-config
export XDG_CACHE_HOME=/private/tmp/m12-02-fix1-cache
export XDG_STATE_HOME=/private/tmp/m12-02-fix1-state
owned=(packages/core/src/ftc/learning.ts packages/core/test/ftc/learning-and-progress/m12-02.test.ts)
printf 'check\tcwd\texit\tcommand\n' > "$logs/fix1-verification.tsv"
run() {
  local label=$1 cwd=$2
  shift 2
  (cd "$cwd" && "$@") > "$logs/$label.log" 2>&1
  local code=$?
  printf '%s\t%s\t%s\t' "$label" "$cwd" "$code" >> "$logs/fix1-verification.tsv"
  printf '%q ' "$@" >> "$logs/fix1-verification.tsv"
  printf '\n' >> "$logs/fix1-verification.tsv"
  return "$code"
}
run fix1-core-covering "$root/packages/core" bun test ./test/ftc/learning-and-progress/m12-01.test.ts ./test/ftc/learning-and-progress/m12-02.test.ts ./test/ftc/ftc-knowledge || exit 1
run fix1-core-typecheck "$root/packages/core" bun typecheck || exit 1
run fix1-lint "$root" "$root/node_modules/.bin/oxlint" "${owned[@]}" || exit 1
run fix1-format "$root" "$root/node_modules/.bin/prettier" --check "${owned[@]}" || exit 1
run fix1-diff-check "$root" git diff --check -- "${owned[@]}" || exit 1
(cd "$root" && shasum -a 256 "${owned[@]}") > "$logs/fix1-source-sha256.txt"
