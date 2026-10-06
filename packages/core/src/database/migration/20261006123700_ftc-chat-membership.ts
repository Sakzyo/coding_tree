import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261006123700_ftc-chat-membership",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`ftc_chat\` (
          \`sequence\` integer PRIMARY KEY AUTOINCREMENT,
          \`chat_id\` text NOT NULL UNIQUE,
          \`project_id\` text NOT NULL,
          \`session_id\` text NOT NULL UNIQUE,
          CONSTRAINT \`fk_ftc_chat_project_id_ftc_project_association_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`ftc_project_association\`(\`project_id\`)
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
