// M9-07 evaluation decision only. M1-09/M9-08 must enforce this before creating a view.
// No platform has complete controller, broker and embedded-control isolation evidence.
export const panelsPolicy = Object.freeze({
  embedded: false,
  controls: false,
  reason: "isolation_unverified",
} as const)
