import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("intelligence migration contracts", () => {
  it("keeps response transitions atomic, invoker-rights and service-only", () => {
    const responseLoop = migration(
      "20260729174000_stage11_feedback_and_evaluation.sql",
    );
    const deliverySchema = migration(
      "20260729152829_intelligence_response_delivery_outcomes.sql",
    );

    expect(responseLoop).toContain(
      "create or replace function public.record_intelligence_delivery",
    );
    expect(responseLoop).toContain(
      "create or replace function public.complete_intelligence_recheck",
    );
    expect(responseLoop.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(2);
    expect(responseLoop).toMatch(
      /revoke all on function public\.record_intelligence_delivery[\s\S]*from public, anon, authenticated;/,
    );
    expect(responseLoop).toMatch(
      /grant execute on function public\.record_intelligence_delivery[\s\S]*to service_role;/,
    );
    expect(deliverySchema).toContain(
      "on public.intelligence_deliveries (action_id, idempotency_key)",
    );
  });

  it("uses a bounded invoker-rights curriculum graph bundle", () => {
    const graph = migration(
      "20260729180000_stage13_curriculum_knowledge_graph.sql",
    );

    expect(graph).toContain(
      "create or replace function public.curriculum_graph_bundle",
    );
    expect(graph).toMatch(
      /curriculum_graph_bundle[\s\S]*security invoker[\s\S]*limit least\(greatest\(coalesce\(p_objective_limit, 600\), 1\), 600\)/,
    );
    expect(graph).toMatch(
      /revoke all on function public\.curriculum_graph_bundle[\s\S]*from public, anon;/,
    );
  });

  it("grants service routes only the operations they use", () => {
    const work = migration(
      "20260729151935_persistent_intelligence_work.sql",
    );
    const response = migration(
      "20260729152829_intelligence_response_delivery_outcomes.sql",
    );

    expect(work).toMatch(
      /grant select, insert, update on table[\s\S]*public\.intelligence_actions[\s\S]*to service_role;/,
    );
    expect(response).toMatch(
      /grant select, insert on table[\s\S]*public\.intelligence_deliveries,[\s\S]*public\.intelligence_outcomes[\s\S]*to service_role;/,
    );
  });
});
