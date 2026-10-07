import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261007065802_ftc-learning-navigation",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`ftc_learning_entry\` (
          \`course_id\` text NOT NULL,
          \`course_version\` text NOT NULL,
          \`entry_level\` text NOT NULL,
          CONSTRAINT \`ftc_learning_entry_pk\` PRIMARY KEY(\`course_id\`, \`course_version\`)
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`ftc_learning_skip\` (
          \`course_id\` text NOT NULL,
          \`course_version\` text NOT NULL,
          \`lesson_id\` text NOT NULL,
          \`lesson_version\` text NOT NULL,
          CONSTRAINT \`ftc_learning_skip_pk\` PRIMARY KEY(\`course_id\`, \`course_version\`, \`lesson_id\`, \`lesson_version\`)
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
