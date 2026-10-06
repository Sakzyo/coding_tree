export * as FtcAgentGate from "./gate"

import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Session } from "@opencode-ai/schema/session"
import { Data, Effect } from "effect"

export type Membership =
  | { readonly kind: "unmanaged" }
  | { readonly kind: "managed"; readonly chat: FtcProject.ChatRef }

export class Blocked extends Data.TaggedError("FtcAgentGate.Blocked")<{
  readonly reason:
    | { readonly kind: "busy"; readonly active: FtcProject.ChatRef }
    | { readonly kind: "rejected"; readonly error: FtcProject.GateError | FtcProject.ChatError }
}> {}

/** Injected by the host; membership and canonical project ownership belong to M2. */
export interface Port {
  /** Resolve from stored placement. A managed root without this Session's chat must fail, never return unmanaged. */
  readonly resolve: (input: {
    readonly sessionID: Session.ID
    readonly location: Location.Ref
  }) => Effect.Effect<Membership, FtcProject.GateError | FtcProject.ChatError>
  /** Acquire a distinct execution claim, including when admission already holds one for this chat.
   * Cancellation before returning a lease must leave no claim behind. */
  readonly acquire: (chat: FtcProject.ChatRef) => Effect.Effect<FtcProject.GateResult, FtcProject.GateError>
  /** Terminal ownership-chain notification. Release only this exact claim; stale notifications are harmless. */
  readonly release: (lease: FtcProject.GateLease) => Effect.Effect<void>
}

/** Explicit compatibility binding for hosts that have not enabled FTC project management. */
export const unmanaged: Port = {
  resolve: () => Effect.succeed({ kind: "unmanaged" }),
  acquire: () => Effect.die("Unmanaged Sessions cannot acquire a project execution claim"),
  release: () => Effect.void,
}
