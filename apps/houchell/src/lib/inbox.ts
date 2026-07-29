import { type NavigationProfile, workspaceLevelFor } from "./navigation";

export interface InboxQueue {
  key: string;
  label: string;
  description: string;
  href: string;
  tone: "accent" | "blue" | "amber";
  source: string;
}

const COMMON: InboxQueue[] = [
  {
    key: "findings",
    label: "Intelligence findings",
    description: "Review evidence, add professional judgement, dismiss noise, or choose a response.",
    href: "/intel",
    tone: "accent",
    source: "Intelligence",
  },
  {
    key: "assessment",
    label: "Assessment and marking",
    description: "Open assessments, marking evidence and the existing review workflow.",
    href: "/assessments",
    tone: "blue",
    source: "Assess",
  },
];

export function inboxQueues(profile?: NavigationProfile | null): InboxQueue[] {
  const level = workspaceLevelFor(profile);
  const queues = [...COMMON];

  if (level === "teacher" || level === "department") {
    queues.push({
      key: "class_followup",
      label: "Class follow-up",
      description: "Check class mastery and identify the next teaching response.",
      href: "/teacher",
      tone: "amber",
      source: "Classes",
    });
  }
  if (level === "department" || profile?.role === "admin" || profile?.is_lead) {
    queues.push({
      key: "content",
      label: "Content review",
      description: "Review shared curriculum content and candidate master resources.",
      href: "/content",
      tone: "blue",
      source: "Content",
    });
  }
  if (level === "school") {
    queues.push(
      {
        key: "interventions",
        label: "Interventions",
        description: "Review pupils and groups awaiting a school-level response.",
        href: "/school/intervention",
        tone: "amber",
        source: "School",
      },
      {
        key: "integrations",
        label: "Data sources",
        description: "Check MIS links, class matching and data freshness.",
        href: "/school/integrations",
        tone: "blue",
        source: "Operations",
      },
    );
  }
  if (level === "trust") {
    queues.push({
      key: "trust_support",
      label: "Trust support",
      description: "Review school-level changes and where support capacity should go.",
      href: "/trust",
      tone: "amber",
      source: "Trust",
    });
  }
  return queues;
}
