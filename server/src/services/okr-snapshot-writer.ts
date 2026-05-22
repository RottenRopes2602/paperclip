// fork_mangoclaw: OKR completion snapshot writer.
// Fires when an Objective transitions to status=achieved. Captures a structured
// snapshot of the OKR (objective + child KRs + linked projects + issue stats)
// and writes it to the company's workspace under `_ops/reports/<okr-folder>/`.
// This preserves the report history in git — workspace = source-of-truth.

import fs from "fs/promises";
import path from "path";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goals, projects, issues, companies, heartbeatRuns } from "@paperclipai/db";

interface SnapshotCriterion {
  text: string;
  state: "pending" | "verified" | "failed";
}

interface SnapshotKr {
  id: string;
  identifier: string | null;
  label: string;             // "KR-1", "KR-2" by sortOrder
  title: string;
  description: string | null;
  status: string;
  criteria: SnapshotCriterion[];
  projects: Array<{
    id: string;
    identifier: string | null;
    name: string;
    status: string;
    issueDone: number;
    issueCancelled: number;
    issueOpen: number;
    issueTotal: number;
  }>;
}

interface OkrSnapshot {
  version: 1;
  generatedAt: string;
  okr: {
    id: string;
    identifier: string | null;
    title: string;
    description: string | null;
    sortOrder: number | null;
    status: string;
    kind: string | null;
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
  krs: SnapshotKr[];
  stats: {
    krCount: number;
    krAchieved: number;
    krCancelled: number;
    projectCount: number;
    issueDone: number;
    issueCancelled: number;
    issueOpen: number;
    issueTotal: number;
    directorCycles: number | null;
    totalCostUsd: number | null;
  };
  closedBy: "cascade_a2" | "manual";
}

// Extract measurement criteria from a goal description.
// Same parser as the UI (OkrSummaryTab).
function parseCriteria(description: string | null): SnapshotCriterion[] {
  if (!description) return [];
  const cleaned = description.replace(/<!--[\s\S]*?-->/g, "");
  const headerMatch = cleaned.match(/(?:##\s*)?측정(?:\s*기준)?\s*:?\s*\n/);
  if (!headerMatch) return [];
  const startIdx = headerMatch.index! + headerMatch[0].length;
  const rest = cleaned.slice(startIdx);
  const stopMatch = rest.match(/\n##\s|\n{3,}/);
  const section = stopMatch ? rest.slice(0, stopMatch.index) : rest;
  const result: SnapshotCriterion[] = [];
  for (const rawLine of section.split(/\n/)) {
    const trimmed = rawLine.trim();
    if (!(trimmed.startsWith("- ") || trimmed.startsWith("* "))) continue;
    const body = trimmed.replace(/^[-*]\s+/, "");
    const firstChar = body.trim().charAt(0);
    let state: SnapshotCriterion["state"] = "pending";
    let text = body;
    if (firstChar === "✓") {
      state = "verified";
      text = body.replace(/^\s*✓\s*/, "");
    } else if (firstChar === "✗") {
      state = "failed";
      text = body.replace(/^\s*✗\s*/, "");
    } else if (firstChar === "⏳") {
      state = "pending";
      text = body.replace(/^\s*⏳\s*/, "");
    }
    result.push({ text, state });
  }
  return result;
}

// Try to extract a slug from the goal's description marker (e.g. "okr-8").
function extractSlug(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/slug=([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

// Sanitize a string to be a safe folder name.
function safeFolderName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

// Build the snapshot data structure by querying DB.
async function buildSnapshot(
  db: Db,
  objectiveId: string,
  closedBy: "cascade_a2" | "manual",
): Promise<OkrSnapshot | null> {
  const objective = await db
    .select()
    .from(goals)
    .where(eq(goals.id, objectiveId))
    .then((rows) => rows[0] ?? null);
  if (!objective) return null;

  const childKrs = await db
    .select()
    .from(goals)
    .where(and(eq(goals.parentId, objectiveId), eq(goals.kind, "key_result")));
  childKrs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const allGoalIds = [objective.id, ...childKrs.map((k) => k.id)];

  // Find linked projects (via goal_id direct or goal_ids array).
  // For now, query all company projects and filter in JS — it's a one-off path
  // and avoids a more complex join. Solo-product scale.
  const companyProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.companyId, objective.companyId));
  const goalIdSet = new Set(allGoalIds);
  const linkedProjects = companyProjects.filter((p) => {
    if (p.goalId && goalIdSet.has(p.goalId)) return true;
    const goalIds = (p as { goalIds?: string[] | null }).goalIds ?? [];
    for (const gid of goalIds) if (goalIdSet.has(gid)) return true;
    return false;
  });
  const projectIdSet = new Set(linkedProjects.map((p) => p.id));

  // Fetch all relevant issues in one query.
  const issueRows =
    projectIdSet.size === 0
      ? []
      : await db
          .select()
          .from(issues)
          .where(
            and(
              eq(issues.companyId, objective.companyId),
              inArray(issues.projectId, Array.from(projectIdSet)),
            ),
          );

  // Per-KR aggregation.
  const krs: SnapshotKr[] = childKrs.map((kr, idx) => {
    const krProjects = linkedProjects.filter((p) => {
      if (p.goalId === kr.id) return true;
      const gids = (p as { goalIds?: string[] | null }).goalIds ?? [];
      return gids.includes(kr.id);
    });
    return {
      id: kr.id,
      identifier: kr.identifier,
      label: `KR-${idx + 1}`,
      title: kr.title,
      description: kr.description,
      status: kr.status,
      criteria: parseCriteria(kr.description),
      projects: krProjects.map((p) => {
        const pIssues = issueRows.filter((i) => i.projectId === p.id);
        const done = pIssues.filter((i) => i.status === "done").length;
        const cancelled = pIssues.filter((i) => i.status === "cancelled").length;
        return {
          id: p.id,
          identifier: p.identifier,
          name: p.name,
          status: p.status,
          issueDone: done,
          issueCancelled: cancelled,
          issueOpen: pIssues.length - done - cancelled,
          issueTotal: pIssues.length,
        };
      }),
    };
  });

  // Heartbeat stats — total Director cycles + cost. Optional; if the table
  // does not match the expected shape, swallow the error and leave nulls.
  let directorCycles: number | null = null;
  let totalCostUsd: number | null = null;
  try {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        cost: sql<number>`coalesce(sum((${heartbeatRuns.usageJson}->>'total_cost_usd')::numeric), 0)::float`,
      })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.companyId, objective.companyId),
          sql`${heartbeatRuns.startedAt} >= ${objective.createdAt}`,
        ),
      );
    directorCycles = rows[0]?.count ?? 0;
    totalCostUsd = rows[0]?.cost ?? 0;
  } catch {
    // Best-effort.
  }

  const issueDone = issueRows.filter((i) => i.status === "done").length;
  const issueCancelled = issueRows.filter((i) => i.status === "cancelled").length;
  const issueOpen = issueRows.length - issueDone - issueCancelled;

  const now = new Date();
  return {
    version: 1,
    generatedAt: now.toISOString(),
    okr: {
      id: objective.id,
      identifier: objective.identifier,
      title: objective.title,
      description: objective.description,
      sortOrder: objective.sortOrder ?? null,
      status: objective.status,
      kind: objective.kind,
    },
    period: {
      start: objective.createdAt.toISOString(),
      end: now.toISOString(),
      days: daysBetween(objective.createdAt, now),
    },
    krs,
    stats: {
      krCount: childKrs.length,
      krAchieved: childKrs.filter((k) => k.status === "achieved").length,
      krCancelled: childKrs.filter((k) => k.status === "cancelled").length,
      projectCount: linkedProjects.length,
      issueDone,
      issueCancelled,
      issueOpen,
      issueTotal: issueRows.length,
      directorCycles,
      totalCostUsd,
    },
    closedBy,
  };
}

// Render the snapshot as a human-readable markdown document.
function renderMarkdown(snap: OkrSnapshot): string {
  const lines: string[] = [];
  lines.push(`# ${snap.okr.title}`);
  lines.push("");
  lines.push(`> 자동 생성됨: ${snap.generatedAt}  ·  closedBy: ${snap.closedBy}`);
  lines.push("");
  lines.push(`- identifier: **G-${snap.okr.identifier ?? "?"}**`);
  lines.push(`- period: ${snap.period.start.slice(0, 10)} ~ ${snap.period.end.slice(0, 10)} (${snap.period.days}일)`);
  lines.push(`- status: ${snap.okr.status}`);
  lines.push("");
  lines.push(`## 통계`);
  lines.push("");
  lines.push(`| 항목 | 값 |`);
  lines.push(`|---|---|`);
  lines.push(`| KR | ${snap.stats.krAchieved}/${snap.stats.krCount} achieved` +
    (snap.stats.krCancelled > 0 ? ` (${snap.stats.krCancelled} cancelled)` : ``) + ` |`);
  lines.push(`| Project | ${snap.stats.projectCount} |`);
  lines.push(`| Issue | ${snap.stats.issueDone} done / ${snap.stats.issueCancelled} cancelled / ${snap.stats.issueOpen} open (${snap.stats.issueTotal}) |`);
  if (snap.stats.directorCycles != null) {
    lines.push(`| Director cycle | ${snap.stats.directorCycles} |`);
  }
  if (snap.stats.totalCostUsd != null) {
    lines.push(`| 누적 비용 (heartbeat 합산) | $${snap.stats.totalCostUsd.toFixed(2)} |`);
  }
  lines.push("");
  lines.push(`## Key Results`);
  lines.push("");
  for (const kr of snap.krs) {
    lines.push(`### ${kr.label} · ${kr.title}`);
    lines.push("");
    lines.push(`- identifier: G-${kr.identifier ?? "?"}  ·  status: **${kr.status}**`);
    if (kr.criteria.length > 0) {
      lines.push(`- 측정 기준:`);
      for (const c of kr.criteria) {
        const marker = c.state === "verified" ? "✓" : c.state === "failed" ? "✗" : "⏳";
        lines.push(`  - ${marker} ${c.text}`);
      }
    } else {
      lines.push(`- 측정 기준: (description 에 명시 안 됨)`);
    }
    if (kr.projects.length > 0) {
      lines.push(`- 연결 프로젝트:`);
      for (const p of kr.projects) {
        lines.push(
          `  - ${p.identifier ?? p.id} (${p.status}) — 이슈 ${p.issueDone} done / ${p.issueCancelled} cancelled / ${p.issueOpen} open`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// Resolve the absolute directory to write to from company.externalSource.workspacePath.
async function resolveReportsDir(
  db: Db,
  companyId: string,
  objective: { id: string; identifier: string | null; title: string; description: string | null },
): Promise<string | null> {
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0] ?? null);
  const externalSource = (company as { externalSource?: { workspacePath?: string | null } | null })
    ?.externalSource;
  const workspacePath = externalSource?.workspacePath;
  if (!workspacePath) return null;

  // Folder name preference: slug from description (e.g. "okr-8"), else identifier+title,
  // else id-prefix as last resort.
  const slug = extractSlug(objective.description);
  const folderName =
    slug ??
    (objective.identifier
      ? `${objective.identifier}-${safeFolderName(objective.title)}`
      : objective.id.slice(0, 8));

  return path.join(workspacePath, "_ops", "reports", folderName);
}

// Public entry — call from goals.ts whenever an Objective becomes achieved.
// Best-effort: failures are logged but do not throw (cascade must not break).
export async function writeOkrSnapshot(
  db: Db,
  objectiveId: string,
  closedBy: "cascade_a2" | "manual",
): Promise<void> {
  try {
    const snap = await buildSnapshot(db, objectiveId, closedBy);
    if (!snap) {
      console.warn(`[fork_mangoclaw:report] snapshot build failed — objective ${objectiveId} not found`);
      return;
    }
    // Re-fetch companyId because the snapshot object does not carry it.
    const ownerRow = await db
      .select({ companyId: goals.companyId })
      .from(goals)
      .where(eq(goals.id, objectiveId))
      .then((rows) => rows[0] ?? null);
    if (!ownerRow?.companyId) {
      console.warn(`[fork_mangoclaw:report] companyId not resolvable for ${objectiveId}`);
      return;
    }
    const dir = await resolveReportsDir(db, ownerRow.companyId, snap.okr);
    if (!dir) {
      console.warn(
        `[fork_mangoclaw:report] no workspace path configured (externalSource.workspacePath) — skipping snapshot for ${objectiveId}`,
      );
      return;
    }
    await fs.mkdir(dir, { recursive: true });
    const jsonPath = path.join(dir, "snapshot.json");
    const mdPath = path.join(dir, "REPORT.md");
    await fs.writeFile(jsonPath, JSON.stringify(snap, null, 2), "utf-8");
    await fs.writeFile(mdPath, renderMarkdown(snap), "utf-8");
    console.log(`[fork_mangoclaw:report] wrote OKR snapshot: ${dir} (closedBy=${closedBy})`);
  } catch (err) {
    console.error("[fork_mangoclaw:report] snapshot write failed:", err);
  }
}
