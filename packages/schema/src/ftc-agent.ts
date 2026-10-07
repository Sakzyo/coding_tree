export * as FtcAgent from "./ftc-agent"

import { Schema } from "effect"
import { FtcJava } from "./ftc-java"
import { ascending } from "./identifier"
import { Project } from "./project"
import { statics } from "./schema"
import { SessionID } from "./session-id"

export const CodeMode = Schema.Literals(["plan-first", "direct"]).annotate({ identifier: "FtcAgent.CodeMode" })
export type CodeMode = typeof CodeMode.Type

export const PlanID = Schema.String.check(Schema.isStartsWith("plan_"))
  .pipe(Schema.brand("FtcAgent.PlanID"))
  .annotate({ identifier: "FtcAgent.PlanID" })
  .pipe(statics((schema) => ({ create: () => schema.make(`plan_${ascending()}`) })))
export type PlanID = typeof PlanID.Type

export interface CodePlan extends Schema.Schema.Type<typeof CodePlan> {}
export const CodePlan = Schema.Struct({
  planID: PlanID,
  projectID: Project.ID,
  sessionID: SessionID,
  proposal: FtcJava.EditProposal,
  explanation: Schema.String,
  expectedRevisions: Schema.Array(FtcJava.Revision).check(Schema.isMinLength(1)),
}).annotate({ identifier: "FtcAgent.CodePlan" })
