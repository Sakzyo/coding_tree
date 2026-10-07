#!/bin/bash
set -u
root=/Users/dylanxu/coding_tree
logs="$root/docs/validation/m12-02"
export PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
export OPENCODE_TEST_HOME=/private/tmp/m12-02-home
export XDG_DATA_HOME=/private/tmp/m12-02-data
export XDG_CONFIG_HOME=/private/tmp/m12-02-config
export XDG_CACHE_HOME=/private/tmp/m12-02-cache
export XDG_STATE_HOME=/private/tmp/m12-02-state
owned=(packages/core/src/ftc/learning.ts packages/core/src/ftc/learning/sql.ts packages/core/src/ftc/knowledge.ts packages/schema/src/ftc-learning.ts packages/schema/src/ftc-knowledge.ts packages/core/test/ftc/learning-and-progress/m12-02.test.ts packages/core/test/ftc/ftc-knowledge/course-metadata.test.ts packages/schema/test/ftc-learning.test.ts packages/schema/test/ftc-course-metadata.test.ts)
printf 'check\tcwd\texit\tcommand\n' > "$logs/verification.tsv"
run() {
  local label=$1 cwd=$2
  shift 2
  (cd "$cwd" && "$@") > "$logs/$label.log" 2>&1
  local code=$?
  printf '%s\t%s\t%s\t' "$label" "$cwd" "$code" >> "$logs/verification.tsv"
  printf '%q ' "$@" >> "$logs/verification.tsv"
  printf '\n' >> "$logs/verification.tsv"
  return "$code"
}
run core-covering-final "$root/packages/core" bun test ./test/ftc/learning-and-progress/m12-01.test.ts ./test/ftc/learning-and-progress/m12-02.test.ts ./test/ftc/ftc-knowledge || exit 1
run schema-covering-final "$root/packages/schema" bun test ./test/ftc-learning.test.ts ./test/ftc-course-metadata.test.ts ./test/contract-hygiene.test.ts || exit 1
run core-typecheck-final "$root/packages/core" bun typecheck || exit 1
run schema-typecheck-final "$root/packages/schema" bun typecheck || exit 1
run migration-check-final "$root/packages/core" bun script/migration.ts --check || exit 1
run lint-final "$root" "$root/node_modules/.bin/oxlint" "${owned[@]}" || exit 1
run format-check-final "$root" "$root/node_modules/.bin/prettier" --check "${owned[@]}" || exit 1
run diff-check-final "$root" git diff --check -- "${owned[@]}" || exit 1
(cd "$root" && shasum -a 256 "${owned[@]}" packages/core/src/database/migration/20261007065802_ftc-learning-navigation.ts packages/core/src/database/migration.gen.ts packages/core/src/database/schema.gen.ts packages/core/schema.json docs/validation/m12-02/snapshot-delta.json) > "$logs/source-sha256.txt"
