// fork_mangoclaw: upper section of the Goals page.
// Renders `level=company` goals as read-only reference cards instead of tree rows.
// These represent absolute standards (Mission · Vision · Values · etc.) that the
// rest of the OKR work is meant to serve. Editing happens via the existing
// /goals/<id> detail route — these cards link there.

import type { Goal } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { cn } from "../lib/utils";

interface MissionVisionCardsProps {
  goals: Goal[];
  onAdd?: () => void;
}

function sortByCreated(list: Goal[]): Goal[] {
  return [...list].sort((a, b) => {
    const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function MissionVisionCards({ goals, onAdd }: MissionVisionCardsProps) {
  const { t } = useTranslation();
  // fork_mangoclaw: prefer kind field when set; fall back to level for rows without kind.
  const companyGoals = sortByCreated(
    goals.filter((g) => (g.kind === "mission" || g.kind === "vision") || (!g.kind && g.level === "company")),
  );

  if (companyGoals.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t("missionVision.empty.none", {
            defaultValue: "Mission · Vision 이 아직 없습니다. 회사의 절대 기준을 적어두면 OKR 제안의 근거가 됩니다.",
          })}
        </p>
        {onAdd && (
          <button
            onClick={onAdd}
            className="mt-3 text-xs text-foreground/80 underline hover:text-foreground"
          >
            {t("missionVision.button.add", { defaultValue: "Mission · Vision 추가" })}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {companyGoals.map((goal) => (
        <Link
          key={goal.id}
          to={`/goals/${goal.id}`}
          className={cn(
            "border border-border rounded-md px-4 py-3 transition-colors no-underline text-inherit",
            "hover:bg-accent/50 hover:border-foreground/20",
          )}
        >
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t("missionVision.label.standard", { defaultValue: "절대 기준" })}
            </span>
          </div>
          <div className="text-sm font-semibold mb-1.5">{goal.title}</div>
          {goal.description && (
            <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
              {/* Strip slug marker comment from description preview */}
              {goal.description.replace(/<!--[\s\S]*?-->/g, "").trim()}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
