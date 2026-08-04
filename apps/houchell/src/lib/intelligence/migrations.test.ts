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

  it("keeps the Stage 15-20 operating system governed and explicitly granted", () => {
    const operatingSystem = migration(
      "20260804164900_stages_15_20_teacher_operating_system.sql",
    );

    expect(operatingSystem).toContain(
      "create view public.intelligence_operating_system_summary",
    );
    expect(operatingSystem).toMatch(
      /intelligence_operating_system_summary[\s\S]*security_invoker = true/,
    );
    expect(operatingSystem).toMatch(
      /create or replace function public\.decide_intelligence_recommendation[\s\S]*security invoker/,
    );
    expect(operatingSystem).toMatch(
      /revoke all on function public\.decide_intelligence_recommendation[\s\S]*from public, anon, authenticated;/,
    );
    expect(operatingSystem).toContain(
      "requires_human_acceptance  boolean not null default true",
    );
    expect(operatingSystem).toContain(
      "create trigger intelligence_lesson_specs_no_update_or_delete",
    );
    expect(operatingSystem).toMatch(
      /grant select on table[\s\S]*public\.intelligence_monitoring_events[\s\S]*to authenticated;/,
    );
  });

  it("keeps the Stage 21-26 continuous brain idempotent, scoped and human-governed", () => {
    const continuous = migration(
      "20260804181415_stages_21_26_continuous_teacher_os.sql",
    );

    expect(continuous).toMatch(
      /create or replace function public\.promote_mis_to_intelligence[\s\S]*security invoker/,
    );
    expect(continuous).toMatch(
      /revoke all on function public\.promote_mis_to_intelligence[\s\S]*from public, anon, authenticated;/,
    );
    expect(continuous).toContain("human_confirmation_required");
    expect(continuous).toMatch(
      /create or replace function public\.audit_continuous_teacher_os_security[\s\S]*to service_role;/,
    );
    expect(continuous).toContain("unique (school_id, workflow_key, run_key)");
    expect(continuous).toContain("candidate_for_review");
    expect(continuous).toContain("automatic_model_promotion");
    expect(continuous).toMatch(
      /create view public\.intelligence_continuous_os_summary[\s\S]*security_invoker = true/,
    );
    expect(continuous).toContain(
      "create trigger intelligence_lesson_quality_immutable",
    );
  });
});
