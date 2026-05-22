// fork_mangoclaw: OKR-only tree view used in the lower section of the Goals page.
// Built as a separate component (instead of reusing GoalTree) so other pages that
// import GoalTree (e.g. GoalDetail) keep their original behavior.
//
// Differences from GoalTree:
//   - Filters out `level=company` rows (those are rendered as Mission/Vision cards
//     in the upper section).
//   - Re-parents orphans: any goal whose parentId points to a hidden `company`-level
//     row is promoted to a root, so the Objective tree never goes empty just because
//     its parent is now rendered elsewhere.

import type { Goal, Project, Issue } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { StatusBadge } from "./StatusBadge";
import { ChevronRight, FolderOpen, ListChecks } from "lucide-react";
import { cn } from "../lib/utils";
import { useState, useMemo } from "react";

interface OkrTreeProps {
  goals: Goal[];
  projects?: Project[];
  issues?: Issue[];
  goalLink?: (goal: Goal) => string;
  onSelect?: (goal: Goal) => void;
}

interface OkrNodeProps {
  goal: Goal;
  children: Goal[];
  allGoals: Goal[];
  projects: Project[];
  issues: Issue[];
  depth: number;
  siblingIndex: number;
  goalLink?: (goal: Goal) => string;
  onSelect?: (goal: Goal) => void;
}

// fork_mangoclaw: project/issue indicator stats per goal node.
// For a KR row: directly linked projects + their issues.
// For an Objective row: aggregate across child KRs + any direct objective-linked projects.
function isProjectLinkedToGoal(project: Project, goalId: string): boolean {
  if (project.goalId === goalId) return true;
  if ((project.goalIds ?? []).includes(goalId)) return true;
  if ((project.goals ?? []).some((g) => g.id === goalId)) return true;
  return false;
}

interface GoalStats {
  projectCount: number;
  issueClosed: number;
  issueTotal: number;
}

function computeStatsForGoal(
  goal: Goal,
  allGoals: Goal[],
  projects: Project[],
  issues: Issue[],
): GoalStats {
  // Collect all goal ids to count under (self + descendants if Objective).
  const inferredKind = goal.kind ?? "key_result";
  const isObjective = inferredKind === "objective";
  const goalIds = new Set<string>([goal.id]);
  if (isObjective) {
    // Walk descendants (KRs) one level — OKR tree is shallow.
    for (const g of allGoals) {
      if (g.parentId === goal.id) goalIds.add(g.id);
    }
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

  let total = 0;
  let closed = 0;
  for (const i of issues) {
    const matches =
      (i.projectId && projectIds.has(i.projectId)) ||
      (i.goalId && goalIds.has(i.goalId));
    if (!matches) continue;
    total += 1;
    if (i.status === "done" || i.status === "cancelled") closed += 1;
  }
  return { projectCount: projectIds.size, issueClosed: closed, issueTotal: total };
}

function sortSiblings(list: Goal[]): Goal[] {
  return [...list].sort((a, b) => {
    const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function OkrNode({ goal, children, allGoals, projects, issues, depth, siblingIndex, goalLink, onSelect }: OkrNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const link = goalLink?.(goal);

  // fork_mangoclaw: per-node project / issue indicator.
  const stats = useMemo(
    () => computeStatsForGoal(goal, allGoals, projects, issues),
    [goal, allGoals, projects, issues],
  );
  const allClosed = stats.issueTotal > 0 && stats.issueClosed === stats.issueTotal;
  const inProgress = stats.issueTotal > 0 && stats.issueClosed < stats.issueTotal;

  const inner = (
    <>
      {hasChildren ? (
        <button
          className="p-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        </button>
      ) : (
        <span className="w-4" />
      )}
      {/* fork_mangoclaw: derived label = OKR-N for Objective, KR-M for Key Result.
          siblingIndex provides N/M from parent sort order. Stable identifier (G-XXX)
          rendered separately at the end as a faded reference handle. */}
      {(() => {
        const inferredKind = goal.kind ?? (depth === 0 ? "objective" : "key_result");
        const isObjective = inferredKind === "objective";
        const derivedLabel = isObjective ? `OKR-${siblingIndex}` : `KR-${siblingIndex}`;
        return (
          <span
            className={cn(
              "font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap",
              isObjective
                ? "text-blue-600/80 dark:text-blue-400/80"
                : "text-muted-foreground",
            )}
          >
            {derivedLabel}
          </span>
        );
      })()}
      <span className="flex-1 truncate">{goal.title}</span>
      {/* fork_mangoclaw: project / issue indicator. Only shows when there is work attached. */}
      {(stats.projectCount > 0 || stats.issueTotal > 0) && (
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
          {stats.projectCount > 0 && (
            <span className="inline-flex items-center gap-0.5" title={`${stats.projectCount} 연결 프로젝트`}>
              <FolderOpen className="h-3 w-3" />
              {stats.projectCount}
            </span>
          )}
          {stats.issueTotal > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-mono",
                allClosed && "text-green-600 dark:text-green-400",
                inProgress && "text-amber-600 dark:text-amber-400",
              )}
              title={`이슈 ${stats.issueClosed}/${stats.issueTotal} 종결 (done/cancelled)`}
            >
              <ListChecks className="h-3 w-3" />
              {stats.issueClosed}/{stats.issueTotal}
            </span>
          )}
        </span>
      )}
      {goal.identifier && (
        <span className="font-mono text-[10px] text-muted-foreground/50 whitespace-nowrap">
          G-{goal.identifier}
        </span>
      )}
      <StatusBadge status={goal.status} ns="goal" />
    </>
  );

  const classes = cn(
    "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer hover:bg-accent/50",
  );

  const sortedChildren = sortSiblings(children);

  return (
    <div>
      {link ? (
        <Link
          to={link}
          className={cn(classes, "no-underline text-inherit")}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {inner}
        </Link>
      ) : (
        <div
          className={classes}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => onSelect?.(goal)}
        >
          {inner}
        </div>
      )}
      {hasChildren && expanded && (
        <div>
          {sortedChildren.map((child, idx) => (
            <OkrNode
              key={child.id}
              goal={child}
              children={allGoals.filter((g) => g.parentId === child.id)}
              allGoals={allGoals}
              projects={projects}
              issues={issues}
              depth={depth + 1}
              siblingIndex={idx + 1}
              goalLink={goalLink}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OkrTree({ goals, projects, issues, goalLink, onSelect }: OkrTreeProps) {
  const { t } = useTranslation();

  // fork_mangoclaw: prefer kind field when set; fall back to level for rows without kind.
  const isOkrItem = (g: Goal) =>
    g.kind === "objective" || g.kind === "key_result" || (!g.kind && g.level !== "company");
  const okrGoals = goals.filter(isOkrItem);
  const okrIds = new Set(okrGoals.map((g) => g.id));

  // A root in the OKR tree = no parentId, OR parent is not in this OKR-only set
  // (which means parent was either a Mission/Vision card or doesn't exist).
  const roots = sortSiblings(okrGoals.filter((g) => !g.parentId || !okrIds.has(g.parentId)));

  const safeProjects = projects ?? [];
  const safeIssues = issues ?? [];

  if (okrGoals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-3 py-4">
        {t("okrTree.empty.noOkr", { defaultValue: "Objective 가 아직 없습니다. (No OKRs yet.)" })}
      </p>
    );
  }

  return (
    <div className="border border-border py-1">
      {roots.map((goal, idx) => (
        <OkrNode
          key={goal.id}
          goal={goal}
          children={okrGoals.filter((g) => g.parentId === goal.id)}
          allGoals={okrGoals}
          projects={safeProjects}
          issues={safeIssues}
          depth={0}
          siblingIndex={idx + 1}
          goalLink={goalLink}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
