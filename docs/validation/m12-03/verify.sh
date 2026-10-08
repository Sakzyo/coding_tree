#!/bin/bash
set -u
task_root=/Users/dylanxu/coding_tree
task_logs="$task_root/docs/validation/m12-03"
export PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
export OPENCODE_TEST_HOME=/private/tmp/m12-03-home
export XDG_DATA_HOME=/private/tmp/m12-03-home/data
export XDG_CONFIG_HOME=/private/tmp/m12-03-home/config
export XDG_CACHE_HOME=/private/tmp/m12-03-home/cache
export XDG_STATE_HOME=/private/tmp/m12-03-home/state
owned=(packages/core/src/ftc/learning.ts packages/core/test/ftc/learning-and-progress/m12-03.test.ts packages/schema/src/ftc-learning.ts packages/schema/test/ftc-learning.test.ts)
printf 'check\tcwd\texit\tcommand\n' > "$task_logs/verification.tsv"
run() {
  local label=$1 cwd=$2
  shift 2
  (cd "$cwd" && "$@") > "$task_logs/$label.log" 2>&1
  local code=$?
  printf '%s\t%s\t%s\t' "$label" "$cwd" "$code" >> "$task_logs/verification.tsv"
  local serialized_command
  printf -v serialized_command '%q ' "$@"
  printf '%s\n' "${serialized_command% }" >> "$task_logs/verification.tsv"
  return "$code"
}
run focused-final "$task_root/packages/core" bun test ./test/ftc/learning-and-progress/m12-03.test.ts || exit 1
run core-covering-final "$task_root/packages/core" bun test ./test/ftc/learning-and-progress ./test/ftc/ftc-knowledge/course-metadata.test.ts ./test/ftc/ftc-knowledge/m11-02.test.ts ./test/ftc/ftc-knowledge/m11-04.test.ts || exit 1
run schema-final "$task_root/packages/schema" bun test ./test/ftc-learning.test.ts || exit 1
run core-typecheck-final "$task_root/packages/core" bun typecheck || exit 1
run schema-typecheck-final "$task_root/packages/schema" bun typecheck || exit 1
run lint-final "$task_root" "$task_root/node_modules/.bin/oxlint" "${owned[@]}" || exit 1
run format-final "$task_root" "$task_root/node_modules/.bin/prettier" --check "${owned[@]}" || exit 1
run diff-check-final "$task_root" git diff --check -- "${owned[@]}" || exit 1
(cd "$task_root" && shasum -a 256 "${owned[@]}") > "$task_logs/source-sha256.txt"
run source-freeze-check "$task_root" shasum -a 256 -c docs/validation/m12-03/source-sha256.txt || exit 1
