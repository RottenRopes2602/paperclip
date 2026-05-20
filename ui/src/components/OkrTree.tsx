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

import type { Goal } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { StatusBadge } from "./StatusBadge";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

interface OkrTreeProps {
  goals: Goal[];
  goalLink?: (goal: Goal) => string;
  onSelect?: (goal: Goal) => void;
}

interface OkrNodeProps {
  goal: Goal;
  children: Goal[];
  allGoals: Goal[];
  depth: number;
  siblingIndex: number;
  goalLink?: (goal: Goal) => string;
  onSelect?: (goal: Goal) => void;
}

function sortSiblings(list: Goal[]): Goal[] {
  return [...list].sort((a, b) => {
    const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

function OkrNode({ goal, children, allGoals, depth, siblingIndex, goalLink, onSelect }: OkrNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const link = goalLink?.(goal);

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
      {/* fork_mangoclaw: use kind field when set; fall back to depth-based inference. */}
      {(() => {
        const inferredKind = goal.kind ?? (depth === 0 ? "objective" : "key_result");
        const isObjective = inferredKind === "objective";
        return (
          <span
            className={cn(
              "font-mono text-[10px] font-semibold tracking-wider",
              isObjective
                ? "text-blue-600/80 dark:text-blue-400/80"
                : "text-muted-foreground",
            )}
          >
            {isObjective ? "OBJ" : "KR"}
          </span>
        );
      })()}
      <span className="font-mono text-xs text-muted-foreground">{pad3(siblingIndex)}</span>
      <span className="flex-1 truncate">{goal.title}</span>
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

export function OkrTree({ goals, goalLink, onSelect }: OkrTreeProps) {
  const { t } = useTranslation();

  // fork_mangoclaw: prefer kind field when set; fall back to level for rows without kind.
  const isOkrItem = (g: Goal) =>
    g.kind === "objective" || g.kind === "key_result" || (!g.kind && g.level !== "company");
  const okrGoals = goals.filter(isOkrItem);
  const okrIds = new Set(okrGoals.map((g) => g.id));

  // A root in the OKR tree = no parentId, OR parent is not in this OKR-only set
  // (which means parent was either a Mission/Vision card or doesn't exist).
  const roots = sortSiblings(okrGoals.filter((g) => !g.parentId || !okrIds.has(g.parentId)));

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
          depth={0}
          siblingIndex={idx + 1}
          goalLink={goalLink}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
