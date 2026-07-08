export interface DashboardRunActivityDay {
  date: string;
  succeeded: number;
  failed: number;
  other: number;
  total: number;
}

export interface DashboardSalesCurrencySummary {
  currency: string;
  grossSales: number;
  netSales: number;
  orderCount: number;
  refundCount: number;
  units: number;
  platformCount: number;
}

export interface DashboardSalesPlatformSummary {
  platformId: string;
  platformName: string;
  workspaceId: string | null;
  status: string;
  fetchedAt: string;
  currency: string | null;
  grossSales: number;
  netSales: number;
  orderCount: number;
  refundCount: number;
  units: number;
  error: string | null;
}

export interface DashboardSalesSummary {
  hasData: boolean;
  workspaceId: string | null;
  updatedAt: string | null;
  currency: string | null;
  grossSales: number;
  netSales: number;
  orderCount: number;
  refundCount: number;
  units: number;
  platformCount: number;
  connectedPlatforms: number;
  errorCount: number;
  byCurrency: Record<string, DashboardSalesCurrencySummary>;
  platforms: DashboardSalesPlatformSummary[];
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  runActivity: DashboardRunActivityDay[];
  sales?: DashboardSalesSummary | null;
}
