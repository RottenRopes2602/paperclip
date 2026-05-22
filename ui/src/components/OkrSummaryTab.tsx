// fork_mangoclaw: Summary / Report tab inside GoalDetail.
// Renders a visual snapshot of an Objective (or KR) — measurement criteria,
// linked projects, issue progress, activity stats. Designed for Monday to
// quickly review an OKR without scanning markdown.
//
// Measurement criteria state is persisted as inline marker prefixes inside
// the goal's description text (the bullet line). Markers:
//   - ⏳ (or no marker) = pending / external verification needed
//   - ✓                 = verified
//   - ✗                 = failed / insufficient
// Clicking an icon cycles ⏳ → ✓ → ✗ → ⏳ and PATCHes the description.

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import type { Goal, Project, Issue } from "@paperclipai/shared";
import { goalsApi } from "../api/goals";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "./StatusBadge";
import { cn, projectUrl } from "../lib/utils";
import {
  FolderOpen,
  ListChecks,
  Target,
  CalendarClock,
  CircleDot,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface OkrSummaryTabProps {
  goal: Goal;
  allGoals: Goal[];
  projects: Project[];
  issues: Issue[];
}

// ────────────────────────────────────────────────────────────────────────────
// Measurement criteria — parser + writer
// ────────────────────────────────────────────────────────────────────────────

type CriterionState = "pending" | "verified" | "failed";

interface ParsedCriterion {
  text: string;        // raw text without the state marker prefix
  state: CriterionState;
  rawLine: string;     // original line (with bullet + marker) — used for surgical PATCH
}

const STATE_MARKERS: Record<CriterionState, string> = {
  pending: "⏳",
  verified: "✓",
  failed: "✗",
};
const MARKER_TO_STATE: Record<string, CriterionState> = {
  "⏳": "pending",
  "✓": "verified",
  "✗": "failed",
};
const NEXT_STATE: Record<CriterionState, CriterionState> = {
  pending: "verified",
  verified: "failed",
  failed: "pending",
};

// Parse a KR description for measurement criteria. Returns one ParsedCriterion per
// bullet under the 측정 section. Each criterion's state is read from the leading
// marker if present (⏳/✓/✗), otherwise defaults to "pending".
function parseCriteria(description: string | null | undefined): ParsedCriterion[] {
  if (!description) return [];
  const cleaned = description.replace(/<!--[\s\S]*?-->/g, "");
  const headerMatch = cleaned.match(/(?:##\s*)?측정(?:\s*기준)?\s*:?\s*\n/);
  if (!headerMatch) return [];
  const startIdx = headerMatch.index! + headerMatch[0].length;
  const rest = cleaned.slice(startIdx);
  const stopMatch = rest.match(/\n##\s|\n{3,}/);
  const section = stopMatch ? rest.slice(0, stopMatch.index) : rest;
  const result: ParsedCriterion[] = [];
  for (const rawLine of section.split(/\n/)) {
    const trimmed = rawLine.trim();
    if (!(trimmed.startsWith("- ") || trimmed.startsWith("* "))) continue;
    const body = trimmed.replace(/^[-*]\s+/, "");
    // Detect state marker at start of body.
    let state: CriterionState = "pending";
    let text = body;
    const firstChar = body.trim().charAt(0);
    if (firstChar && MARKER_TO_STATE[firstChar]) {
      state = MARKER_TO_STATE[firstChar];
      text = body.replace(/^\s*[⏳✓✗]\s*/, "");
    }
    result.push({ text, state, rawLine });
  }
  return result;
}

// Produce an updated description string where one bullet line has its state marker
// rewritten. Surgical — only the matched rawLine is replaced.
function rewriteCriterionState(
  description: string,
  rawLine: string,
  nextState: CriterionState,
): string {
  // Strip any existing marker, then prepend the next marker.
  const trimmed = rawLine.trim();
  const bulletPrefix = trimmed.startsWith("- ") ? "- " : "* ";
  const body = trimmed.replace(/^[-*]\s+/, "").replace(/^\s*[⏳✓✗]\s*/, "");
  const indent = rawLine.match(/^\s*/)?.[0] ?? "";
  const nextLine = `${indent}${bulletPrefix}${STATE_MARKERS[nextState]} ${body}`;
  // Replace just this line (anchored). Use string replace once.
  return description.replace(rawLine, nextLine);
}

function isProjectLinkedToGoal(project: Project, goalId: string): boolean {
  if (project.goalId === goalId) return true;
  if ((project.goalIds ?? []).includes(goalId)) return true;
  if ((project.goals ?? []).some((g) => g.id === goalId)) return true;
  return false;
}

interface GoalStats {
  projectCount: number;
  issueDone: number;
  issueCancelled: number;
  issueOpen: number;
  issueTotal: number;
}

function computeStats(
  goal: Goal,
  allGoals: Goal[],
  projects: Project[],
  issues: Issue[],
  includeDescendants: boolean,
): GoalStats {
  const goalIds = new Set<string>([goal.id]);
  if (includeDescendants) {
    for (const g of allGoals) if (g.parentId === goal.id) goalIds.add(g.id);
  }
  const projectIds = new Set<string>();
  for (const p of projects) {
    for (const gid of goalIds) {
      if (isProjectLinkedToGoal(p, gid)) {
        projectIds.add(p.id);
        break;
      }
    }
  }
  let done = 0;
  let cancelled = 0;
  let open = 0;
  let total = 0;
  for (const i of issues) {
    const matches =
      (i.projectId && projectIds.has(i.projectId)) ||
      (i.goalId && goalIds.has(i.goalId));
    if (!matches) continue;
    total += 1;
    if (i.status === "done") done += 1;
    else if (i.status === "cancelled") cancelled += 1;
    else open += 1;
  }
  return { projectCount: projectIds.size, issueDone: done, issueCancelled: cancelled, issueOpen: open, issueTotal: total };
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function daysBetween(start: Date | string | null | undefined, end: Date | string | null | undefined): number | null {
  if (!start || !end) return null;
  try {
    const s = typeof start === "string" ? new Date(start) : start;
    const e = typeof end === "string" ? new Date(end) : end;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// KR card — used when the parent goal is an Objective.
// ────────────────────────────────────────────────────────────────────────────

// Renders the small status icon for a criterion. Color + icon per state.
function CriterionIcon({ state, className }: { state: CriterionState; className?: string }) {
  if (state === "verified") {
    return <CheckCircle2 className={cn("h-3.5 w-3.5 text-green-600 dark:text-green-400", className)} />;
  }
  if (state === "failed") {
    return <XCircle className={cn("h-3.5 w-3.5 text-red-600 dark:text-red-400", className)} />;
  }
  return <Clock className={cn("h-3.5 w-3.5 text-amber-500/80", className)} />;
}

interface CriterionRowProps {
  criterion: ParsedCriterion;
  onToggle: () => void;
  disabled?: boolean;
  compact?: boolean;
}

function CriterionRow({ criterion, onToggle, disabled, compact }: CriterionRowProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      title={
        disabled
          ? criterion.text
          : `클릭으로 토글 (${STATE_MARKERS[criterion.state]} → ${STATE_MARKERS[NEXT_STATE[criterion.state]]})`
      }
      className={cn(
        "w-full flex items-start gap-2 text-left",
        compact ? "text-xs" : "text-sm",
        compact ? "" : "px-3 py-2",
        "rounded transition-colors",
        !disabled && "hover:bg-accent/40 cursor-pointer",
        disabled && "cursor-default",
      )}
    >
      <CriterionIcon state={criterion.state} className={cn("mt-0.5 shrink-0", compact && "h-3 w-3")} />
      <span
        className={cn(
          "leading-snug",
          criterion.state === "verified" && "text-foreground/80",
          criterion.state === "failed" && "text-muted-foreground line-through decoration-red-400/60",
          criterion.state === "pending" && "text-muted-foreground",
        )}
      >
        {criterion.text}
      </span>
    </button>
  );
}

function KrCard({
  kr,
  index,
  projects,
  issues,
  onToggleCriterion,
}: {
  kr: Goal;
  index: number;
  projects: Project[];
  issues: Issue[];
  onToggleCriterion: (goalId: string, criterion: ParsedCriterion) => void;
}) {
  const stats = useMemo(() => computeStats(kr, [], projects, issues, false), [kr, projects, issues]);
  const criteria = useMemo(() => parseCriteria(kr.description), [kr.description]);
  const linkedProjects = useMemo(
    () => projects.filter((p) => isProjectLinkedToGoal(p, kr.id)),
    [projects, kr.id],
  );

  const closed = stats.issueDone + stats.issueCancelled;
  const allClosed = stats.issueTotal > 0 && closed === stats.issueTotal;

  const verifiedCount = criteria.filter((c) => c.state === "verified").length;
  const failedCount = criteria.filter((c) => c.state === "failed").length;

  return (
    <div className="border border-border rounded-md p-3 hover:bg-accent/20 hover:border-foreground/20 transition-colors">
      <Link
        to={`/goals/${kr.id}`}
        className="flex items-baseline gap-2 mb-2 no-underline text-inherit"
      >
        <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
          KR-{index}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          G-{kr.identifier ?? "?"}
        </span>
        <div className="flex-1" />
        <StatusBadge status={kr.status} ns="goal" />
      </Link>

      <Link to={`/goals/${kr.id}`} className="block no-underline text-inherit">
        <div className="text-sm font-medium mb-2 line-clamp-2">{kr.title}</div>
      </Link>

      {criteria.length > 0 && (
        <div className="mb-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
            <span>측정 기준 ({criteria.length})</span>
            {(verifiedCount > 0 || failedCount > 0) && (
              <span className="font-mono normal-case tracking-normal">
                {verifiedCount > 0 && <span className="text-green-600 dark:text-green-400">✓{verifiedCount}</span>}
                {failedCount > 0 && <span className="text-red-600 dark:text-red-400 ml-1">✗{failedCount}</span>}
              </span>
            )}
          </div>
          <ul className="space-y-0">
            {criteria.map((c, i) => (
              <li key={i}>
                <CriterionRow
                  criterion={c}
                  onToggle={() => onToggleCriterion(kr.id, c)}
                  compact
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FolderOpen className="h-3 w-3" />
          {linkedProjects.length}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono",
            allClosed && "text-green-600 dark:text-green-400",
            !allClosed && stats.issueTotal > 0 && "text-amber-600 dark:text-amber-400",
          )}
        >
          <ListChecks className="h-3 w-3" />
          {closed}/{stats.issueTotal}
          {stats.issueCancelled > 0 && (
            <span className="text-muted-foreground/60 ml-1">(✗{stats.issueCancelled})</span>
          )}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Summary tab
// ────────────────────────────────────────────────────────────────────────────

export function OkrSummaryTab({ goal, allGoals, projects, issues }: OkrSummaryTabProps) {
  const queryClient = useQueryClient();
  const isObjective = (goal.kind ?? "key_result") === "objective";
  const krs = useMemo(
    () =>
      isObjective
        ? [...allGoals.filter((g) => g.parentId === goal.id)].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
          )
        : [],
    [isObjective, allGoals, goal.id],
  );

  // fork_mangoclaw: PATCH criterion state by rewriting the bullet line in the
  // target goal's description. Each goal (Objective or KR) holds its own criteria.
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);
  const toggleCriterionMutation = useMutation({
    mutationFn: async (input: { goalId: string; description: string }) =>
      goalsApi.update(input.goalId, { description: input.description }),
    onMutate: ({ goalId }) => setPendingGoalId(goalId),
    onSettled: () => setPendingGoalId(null),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(vars.goalId) });
      if (goal.companyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.list(goal.companyId) });
      }
    },
  });

  const handleToggleCriterion = (targetGoalId: string, criterion: ParsedCriterion) => {
    // Find the goal whose description holds this criterion.
    const target = targetGoalId === goal.id ? goal : allGoals.find((g) => g.id === targetGoalId);
    if (!target || !target.description) return;
    const nextState = NEXT_STATE[criterion.state];
    const nextDesc = rewriteCriterionState(target.description, criterion.rawLine, nextState);
    if (nextDesc === target.description) return; // no-op safety
    toggleCriterionMutation.mutate({ goalId: targetGoalId, description: nextDesc });
  };

  const linkedProjects = useMemo(() => {
    const goalIds = new Set<string>([goal.id, ...krs.map((k) => k.id)]);
    return projects.filter((p) => {
      for (const gid of goalIds) if (isProjectLinkedToGoal(p, gid)) return true;
      return false;
    });
  }, [goal.id, krs, projects]);

  const overallStats = useMemo(
    () => computeStats(goal, allGoals, projects, issues, isObjective),
    [goal, allGoals, projects, issues, isObjective],
  );

  const krAchievedCount = krs.filter((k) => k.status === "achieved").length;
  const krProgress = krs.length > 0 ? Math.round((krAchievedCount / krs.length) * 100) : 0;

  const days = daysBetween(goal.createdAt, goal.status === "achieved" ? goal.updatedAt : new Date());

  const criteria = useMemo(() => parseCriteria(goal.description), [goal.description]);
  const verifiedCount = criteria.filter((c) => c.state === "verified").length;
  const failedCount = criteria.filter((c) => c.state === "failed").length;

  return (
    <div className="space-y-6 mt-4">
      {/* Header card */}
      <div className="border border-border rounded-md p-4 bg-card">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-4 w-4" />
            <span className="font-mono">G-{goal.identifier ?? "?"}</span>
            <span>·</span>
            <CalendarClock className="h-3 w-3" />
            <span>
              {formatDate(goal.createdAt)} ~ {goal.status === "achieved" ? formatDate(goal.updatedAt) : "진행중"}
            </span>
            {days != null && <span className="text-muted-foreground/60">({days}일)</span>}
          </div>
          <StatusBadge status={goal.status} ns="goal" />
        </div>

        {isObjective && krs.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">KR 진행률</span>
              <span className="font-mono">
                {krAchievedCount}/{krs.length} achieved · {krProgress}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  krProgress === 100 ? "bg-green-500" : "bg-blue-500",
                )}
                style={{ width: `${krProgress}%` }}
              />
            </div>
          </div>
        )}

        {!isObjective && criteria.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            측정 기준이 description 에 명시되지 않음. KR description 에 "측정:" 또는 "## 측정 기준" 섹션을 추가하면 여기 체크리스트로 표시됩니다.
          </p>
        )}
      </div>

      {/* KR grid — when goal is an Objective */}
      {isObjective && krs.length > 0 && (
        <div>
          <div className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-2">
            Key Results ({krs.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {krs.map((kr, idx) => (
              <KrCard
                key={kr.id}
                kr={kr}
                index={idx + 1}
                projects={projects}
                issues={issues}
                onToggleCriterion={handleToggleCriterion}
              />
            ))}
          </div>
        </div>
      )}

      {/* Measurement criteria — when goal is a KR */}
      {!isObjective && criteria.length > 0 && (
        <div>
          <div className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-2 flex items-center gap-2">
            <span>측정 기준 ({criteria.length})</span>
            {(verifiedCount > 0 || failedCount > 0) && (
              <span className="font-mono normal-case tracking-normal">
                {verifiedCount > 0 && (
                  <span className="text-green-600 dark:text-green-400">✓{verifiedCount}</span>
                )}
                {failedCount > 0 && (
                  <span className="text-red-600 dark:text-red-400 ml-1">✗{failedCount}</span>
                )}
                <span className="text-muted-foreground/60 ml-1">
                  / {criteria.length}
                </span>
              </span>
            )}
          </div>
          <ul className="border border-border rounded-md divide-y divide-border">
            {criteria.map((c, i) => (
              <li key={i}>
                <CriterionRow
                  criterion={c}
                  onToggle={() => handleToggleCriterion(goal.id, c)}
                  disabled={pendingGoalId === goal.id}
                />
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground/70 mt-1.5">
            클릭으로 토글: ⏳ 대기 → ✓ 통과 → ✗ 부족. 상태는 KR description bullet 앞 marker 로 박혀 git 으로 보존됨.
          </p>
        </div>
      )}

      {/* Linked projects */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            연결 프로젝트 ({linkedProjects.length})
          </span>
          {overallStats.issueTotal > 0 && (
            <span className="text-[11px] text-muted-foreground font-mono">
              이슈 {overallStats.issueDone + overallStats.issueCancelled}/{overallStats.issueTotal} 종결
              {overallStats.issueOpen > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  · open {overallStats.issueOpen}
                </span>
              )}
            </span>
          )}
        </div>
        {linkedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">연결된 프로젝트가 없습니다.</p>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border">
            {linkedProjects.map((p) => {
              const pIssues = issues.filter((i) => i.projectId === p.id);
              const pDone = pIssues.filter((i) => i.status === "done").length;
              const pCanc = pIssues.filter((i) => i.status === "cancelled").length;
              const pOpen = pIssues.length - pDone - pCanc;
              return (
                <Link
                  key={p.id}
                  to={projectUrl(p)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors no-underline text-inherit"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mb-0.5">
                      <span className="font-mono">{p.identifier ?? p.urlKey}</span>
                    </div>
                    <div className="text-sm truncate">{p.name}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                    {pIssues.length > 0 && (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {pDone}
                        </span>
                        {pCanc > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-muted-foreground/60">
                            <XCircle className="h-3 w-3" />
                            {pCanc}
                          </span>
                        )}
                        {pOpen > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <CircleDot className="h-3 w-3" />
                            {pOpen}
                          </span>
                        )}
                      </span>
                    )}
                    <StatusBadge status={p.status} ns="project" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity summary */}
      <div className="border border-border rounded-md p-3 bg-muted/30">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">활동 요약</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground/70">기간</div>
            <div className="font-mono font-medium">{days != null ? `${days}일` : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground/70">프로젝트</div>
            <div className="font-mono font-medium">{overallStats.projectCount}</div>
          </div>
          <div>
            <div className="text-muted-foreground/70">이슈 (done/cancel)</div>
            <div className="font-mono font-medium">
              {overallStats.issueDone}/{overallStats.issueCancelled}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground/70">남은 open</div>
            <div
              className={cn(
                "font-mono font-medium",
                overallStats.issueOpen > 0 && "text-amber-600 dark:text-amber-400",
              )}
            >
              {overallStats.issueOpen}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
