import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261006121634_ftc-project-association",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`ftc_project_association\` (
          \`canonical_root\` text PRIMARY KEY,
          \`project_id\` text NOT NULL UNIQUE,
          \`host_project_id\` text NOT NULL,
          \`host_project_directory\` text NOT NULL
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
