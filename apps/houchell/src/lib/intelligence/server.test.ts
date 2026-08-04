import { describe, expect, it } from "vitest";
import {
  chunks,
  IntelligenceRestError,
  isMissingDatabaseObject,
  jsonNoStore,
  UUID_RE,
} from "./server";

describe("intelligence server boundary", () => {
  it("validates canonical UUIDs rather than arbitrary 36-character strings", () => {
    expect(UUID_RE.test("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(UUID_RE.test("------------------------------------")).toBe(false);
  });

  it("classifies missing PostgREST relations without treating every 400 as pending", () => {
    const missing = new IntelligenceRestError(
      400,
      JSON.stringify({ code: "42P01", message: 'relation "public.example" does not exist' }),
    );
    const invalid = new IntelligenceRestError(
      400,
      JSON.stringify({ code: "22023", message: "invalid parameter" }),
    );

    expect(isMissingDatabaseObject(missing, ["example"])).toBe(true);
    expect(isMissingDatabaseObject(missing, ["different_table"])).toBe(false);
    expect(isMissingDatabaseObject(invalid, ["example"])).toBe(false);
    expect(
      isMissingDatabaseObject(
        new Error("rpc/example: 404 function was not found in the schema cache"),
        ["example"],
      ),
    ).toBe(true);
  });

  it("creates bounded chunks and no-store JSON responses", async () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    const response = jsonNoStore({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
