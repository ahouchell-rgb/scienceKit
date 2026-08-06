import { UUID_RE } from "@/lib/intelligence/server";

export class ValidationError extends Error {
  readonly status = 400;
}

const objectBody = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Request body must be an object");
  }
  return value as Record<string, unknown>;
};

const requiredString = (
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
) => {
  const text = typeof value === "string" ? value.trim() : "";
  const min = options.min ?? 1;
  const max = options.max ?? 2000;
  if (text.length < min || text.length > max) {
    throw new ValidationError(`${label} must be between ${min} and ${max} characters`);
  }
  return text;
};

export const requiredUuid = (value: unknown, label: string) => {
  const id = requiredString(value, label, { max: 36 });
  if (!UUID_RE.test(id)) throw new ValidationError(`${label} must be a valid id`);
  return id;
};

export const optionalString = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${label} is not supported`);
  }
  return value as T;
};

export type OperatingSystemOperation =
  | "refresh_health"
  | "prepare_recommendation"
  | "decide_recommendation"
  | "evaluate_policy"
  | "review_model"
  | "run_adaptive_cycle";

const OPERATING_SYSTEM_OPERATIONS = [
  "refresh_health",
  "prepare_recommendation",
  "decide_recommendation",
  "evaluate_policy",
  "review_model",
  "run_adaptive_cycle",
] as const;

export function parseOperatingSystemCommand(value: unknown) {
  const body = objectBody(value);
  return {
    ...body,
    schoolId: requiredUuid(body.schoolId, "School"),
    operation: oneOf(body.operation, OPERATING_SYSTEM_OPERATIONS, "Operation"),
  } as Record<string, unknown> & {
    schoolId: string;
    operation: OperatingSystemOperation;
  };
}

export function parseCopilotRequest(value: unknown) {
  const body = objectBody(value);
  return {
    schoolId: requiredUuid(body.schoolId, "School"),
    message: requiredString(body.message, "Question", { min: 3, max: 2000 }),
  };
}
