import { createHash } from "node:crypto";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function artifactFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

export function artifactBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(stableValue(value)), "utf8");
}

export function artifactChanged(
  generatedFingerprint?: string | null,
  deliveredFingerprint?: string | null,
): boolean | null {
  if (!generatedFingerprint || !deliveredFingerprint) return null;
  return generatedFingerprint !== deliveredFingerprint;
}
