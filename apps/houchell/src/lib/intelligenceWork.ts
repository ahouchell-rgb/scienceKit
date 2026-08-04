export const ACTION_STATUSES = [
  "proposed",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type IntelligenceActionStatus = (typeof ACTION_STATUSES)[number];

const TRANSITIONS: Record<IntelligenceActionStatus, IntelligenceActionStatus[]> = {
  proposed: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["proposed"],
};

export interface ActionTransitionContext {
  current: IntelligenceActionStatus;
  next: IntelligenceActionStatus;
  actorId: string;
  ownerId?: string | null;
  createdBy: string;
  canManageScope: boolean;
  requiresHumanAcceptance?: boolean;
  outcomeSummary?: string | null;
}

export interface WorkVerdict {
  allowed: boolean;
  reason?: string;
}

export function canTransitionAction(context: ActionTransitionContext): WorkVerdict {
  if (context.current === context.next) {
    return { allowed: false, reason: "The action is already in that state." };
  }
  if (!TRANSITIONS[context.current].includes(context.next)) {
    return {
      allowed: false,
      reason: `Actions cannot move directly from ${context.current} to ${context.next}.`,
    };
  }

  if (context.next === "accepted" && !context.ownerId) {
    return { allowed: false, reason: "Assign an owner before accepting the action." };
  }

  const isOwner = Boolean(context.ownerId && context.ownerId === context.actorId);
  const isCreator = context.createdBy === context.actorId;
  const canControl = isOwner || isCreator || context.canManageScope;
  if (!canControl) {
    return { allowed: false, reason: "Only the owner, creator or scoped leader can change this action." };
  }

  if (context.next === "accepted") {
    if (!isOwner && !context.canManageScope) {
      return { allowed: false, reason: "The owner or a scoped leader must accept the action." };
    }
  }

  if (context.next === "completed" && (context.outcomeSummary?.trim().length || 0) < 3) {
    return { allowed: false, reason: "Record an outcome before completing the action." };
  }

  return { allowed: true };
}

export function normaliseDueAt(value?: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

export function workUrgency(
  dueAt: string | null | undefined,
  status: IntelligenceActionStatus,
  now = Date.now(),
): "closed" | "overdue" | "due_soon" | "scheduled" | "unscheduled" {
  if (status === "completed" || status === "cancelled") return "closed";
  if (!dueAt) return "unscheduled";
  const timestamp = Date.parse(dueAt);
  if (!Number.isFinite(timestamp)) return "unscheduled";
  if (timestamp < now) return "overdue";
  if (timestamp - now <= 3 * 24 * 60 * 60 * 1000) return "due_soon";
  return "scheduled";
}
