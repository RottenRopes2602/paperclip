import { useEffect, useMemo } from "react";
import { useTranslation } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
// fork_mangoclaw: Goals page split into Mission·Vision (top) + OKR tree (bottom).
import { MissionVisionCards } from "../components/MissionVisionCards";
import { OkrTree } from "../components/OkrTree";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Target, Plus } from "lucide-react";

export function Goals() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: t("goals.breadcrumb.goals", { defaultValue: "Goals" }) }]);
  }, [setBreadcrumbs, t]);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // fork_mangoclaw: fetch projects + issues so OkrTree can show per-goal indicators.
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!, { limit: 1000 }),
    enabled: !!selectedCompanyId,
  });

  // fork_mangoclaw: count OKR-only items (level != company) for empty-state branching.
  const okrCount = useMemo(
    () => (goals ?? []).filter((g) => g.level !== "company").length,
    [goals],
  );

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Target}
        message={t("goals.empty.selectCompany", {
          defaultValue: "회사를 선택하면 목표를 볼 수 있습니다. (Select a company to view goals.)",
        })}
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Target}
          message={t("goals.empty.noGoals", { defaultValue: "아직 목표가 없습니다. (No goals yet.)" })}
          action={t("goals.button.addGoal", { defaultValue: "목표 추가 (Add Goal)" })}
          onAction={() => openNewGoal()}
        />
      )}

      {goals && goals.length > 0 && (
        <>
          {/* fork_mangoclaw: upper section — Mission · Vision (absolute standards). */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold tracking-wide">
                {t("goals.section.missionVision", { defaultValue: "Mission · Vision" })}
              </h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t("goals.section.missionVisionHint", { defaultValue: "절대 기준 — 자주 안 바뀜" })}
              </span>
            </div>
            <MissionVisionCards goals={goals} onAdd={() => openNewGoal()} />
          </section>

          {/* fork_mangoclaw: lower section — OKR (Objective → KR tree). */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide">
                {t("goals.section.okr", { defaultValue: "OKR" })}
              </h2>
              <Button size="sm" variant="outline" onClick={() => openNewGoal()}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("goals.button.newGoal", { defaultValue: "새 목표 (New Goal)" })}
              </Button>
            </div>
            {okrCount === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-4 border border-dashed border-border rounded-md">
                {t("okrTree.empty.noOkr", {
                  defaultValue: "Objective 가 아직 없습니다. (No OKRs yet.)",
                })}
              </p>
            ) : (
              <OkrTree
                goals={goals}
                projects={projects ?? []}
                issues={issues ?? []}
                goalLink={(g) => `/goals/${g.id}`}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
