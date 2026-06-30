import { api } from "./client";

export interface SpliceAgentRunRequest {
  id: string;
  companyId: string;
  companyName: string;
  agentId: string;
  agentName: string;
  status: "requested" | "launch_ready" | "launched" | "failed" | string;
  requestedAt: string;
  updatedAt: string;
  note?: string;
  ageSeconds?: number;
  state?: "fresh" | "waiting" | "launched";
}

export interface SpliceWorkspaceAgent {
  id: string;
  name: string;
  urlKey: string;
  role: string;
  title: string | null;
  status: "idle" | "running" | "requested" | "launched" | "error" | string;
  source: string;
  lastHeartbeatAt: string | null;
  request: SpliceAgentRunRequest | null;
}

export interface SpliceWorkspace {
  id: string;
  slug: string;
  name: string;
  prefix: string;
  path: string | null;
  state: "idle" | "running" | "requested" | "launched" | "blocked" | "stale";
  projectsActive: number;
  projectsTotal: number;
  issuesActive: number;
  cardsOpen: number;
  activeReal: number;
  stale: number;
  blocked: number;
  review: number;
  sessions: number;
  lastActivityMin: number | null;
  agentCount: number;
  runningAgents: number;
  requestedAgents: number;
  liveRuns: number;
  agents: SpliceWorkspaceAgent[];
  primaryAgent: SpliceWorkspaceAgent | null;
  requests: SpliceAgentRunRequest[];
}

export interface SpliceOverviewData {
  generatedAt: string;
  mode: "disk-first";
  dataSource: string;
  fleet: {
    running: number;
    abandoned: number;
  };
  sessionsTotal: number;
  totals: {
    workspaces: number;
    agents: number;
    runningAgents: number;
    requestedAgents: number;
    launchedAgents?: number;
    liveRuns: number;
    activeWork: number;
    blocked: number;
    stale: number;
    openCards: number;
    sessions: number;
  };
  runner: {
    queuePath: string;
    command: string;
    pending: number;
    launched: number;
    failed: number;
    active: number;
    total: number;
    canDispatch: boolean;
    latest: {
      id: string;
      companyId: string;
      agentId: string;
      status: string;
      updatedAt: string;
    } | null;
  };
  companies: SpliceWorkspace[];
  requests: SpliceAgentRunRequest[];
}

export interface SpliceRunnerDispatch {
  status: "runner_dispatched" | "dry_run_dispatched" | string;
  pid: number | null;
  dryRun: boolean;
  pending: number;
  requestId: string;
  runner: SpliceOverviewData["runner"];
}

export const spliceApi = {
  overview: () => api.get<SpliceOverviewData>("/splice/overview"),
  runAgent: (companyId: string, agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  dispatchRunner: () => api.post<SpliceRunnerDispatch>("/splice/runner/dispatch", {}),
};
