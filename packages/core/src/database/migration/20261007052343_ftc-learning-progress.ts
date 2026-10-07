import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261007052343_ftc-learning-progress",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`ftc_learning_attempt\` (
          \`course_id\` text NOT NULL,
          \`lesson_id\` text NOT NULL,
          \`lesson_version\` text NOT NULL,
          \`attempt_id\` text NOT NULL,
          \`project_id\` text NOT NULL,
          \`configuration_revision\` text NOT NULL,
          \`outcome\` text NOT NULL,
          \`evidence_json\` text NOT NULL,
          \`explanation\` text NOT NULL,
          CONSTRAINT \`ftc_learning_attempt_pk\` PRIMARY KEY(\`course_id\`, \`lesson_id\`, \`lesson_version\`, \`attempt_id\`)
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
