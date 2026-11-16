// The approval state machine: DRAFT -> PENDING_REVIEW -> APPROVED -> SENT,
// with REJECTED and CANCELLED as terminal side-exits. Every transition in
// this codebase goes through assertTransition — there is no code path that
// writes Activation.status without checking this table first, which is what
// makes "SENT without APPROVED" and "REJECTED made sendable" structurally
// impossible rather than just conventionally avoided.

export type ActivationStatusValue =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SENT"
  | "CANCELLED";

const ALLOWED_TRANSITIONS: Record<ActivationStatusValue, ActivationStatusValue[]> = {
  DRAFT: ["PENDING_REVIEW", "CANCELLED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  REJECTED: [],
  SENT: [],
  CANCELLED: [],
};

export class InvalidActivationTransitionError extends Error {
  constructor(from: ActivationStatusValue, to: ActivationStatusValue) {
    super(`Cannot transition an activation from ${from} to ${to}.`);
    this.name = "InvalidActivationTransitionError";
  }
}

export function canTransition(from: ActivationStatusValue, to: ActivationStatusValue): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ActivationStatusValue, to: ActivationStatusValue): void {
  if (!canTransition(from, to)) {
    throw new InvalidActivationTransitionError(from, to);
  }
}
