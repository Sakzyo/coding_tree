export * as FtcKnowledgeContext from "./context"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { Effect } from "effect"
import type { Interface } from "../knowledge"
import { SystemContext } from "../../system-context"

export function source(input: {
  readonly key: SystemContext.Key
  readonly service: Interface
  readonly query: FtcKnowledge.ContentQuery
}): SystemContext.Source<FtcKnowledge.ContentResult> {
  return {
    key: input.key,
    codec: FtcKnowledge.ContentResult,
    load: Effect.suspend(() => input.service.lookup(input.query)).pipe(
      Effect.catch(() => Effect.succeed(SystemContext.unavailable)),
    ),
    baseline: (current) => JSON.stringify(current),
    update: (_previous, current) => JSON.stringify(current),
  }
}
