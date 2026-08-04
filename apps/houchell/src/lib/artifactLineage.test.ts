import { describe, expect, it } from "vitest";
import {
  artifactBytes,
  artifactChanged,
  artifactFingerprint,
} from "./artifactLineage";

describe("artifact lineage", () => {
  it("fingerprints equivalent objects deterministically", () => {
    expect(artifactFingerprint({ b: 2, a: [{ y: 2, x: 1 }] })).toBe(
      artifactFingerprint({ a: [{ x: 1, y: 2 }], b: 2 }),
    );
  });

  it("detects a meaningful edit and records serialised size", () => {
    const generated = artifactFingerprint([{ title: "Hinge", answer: "A" }]);
    const delivered = artifactFingerprint([{ title: "Hinge", answer: "B" }]);
    expect(artifactChanged(generated, delivered)).toBe(true);
    expect(artifactChanged(generated, generated)).toBe(false);
    expect(artifactChanged(null, delivered)).toBeNull();
    expect(artifactBytes([{ title: "Hinge" }])).toBeGreaterThan(0);
  });
});
