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
  roomPath?: string;
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

export interface SpliceWorkspaceRoomWorkItem {
  id: string;
  type: "project" | "issue";
  title: string;
  status: string;
  bucket: "active" | "review" | "todo" | "blocked" | "done" | string;
  progressWeight: number;
  ownerSlug: string | null;
  ownerName: string;
  projectSlug: string | null;
  projectName: string;
  priority: string | null;
  ageMin: number | null;
  description: string | null;
}

export interface SpliceWorkspaceRoomProject extends SpliceWorkspaceRoomWorkItem {
  progress: number;
  issueCounts: {
    active: number;
    review: number;
    todo: number;
    blocked: number;
    done: number;
  };
  issueTotal: number;
}

export interface SpliceWorkspaceRoomActor {
  id: string;
  slug: string;
  name: string;
  initials: string;
  role: string;
  state: "working" | "reviewing" | "requested" | "queued" | "idle" | "blocked" | "present" | "away" | string;
  zone: string;
  x: number;
  y: number;
  currentWork: SpliceWorkspaceRoomWorkItem[];
  activeCount: number;
  reviewCount: number;
  queuedCount: number;
  request?: SpliceAgentRunRequest | null;
  session?: {
    branch: string;
    dirty: number;
    path: string;
    lastCommit: { sha?: string; msg?: string; ageMin?: number } | null;
  } | null;
}

export interface SpliceWorkspaceRoomData {
  generatedAt: string;
  id: string;
  name: string;
  mode: "single-workspace-live-room";
  path: string;
  shortPath: string;
  dataSource: string;
  objective: { name?: string; slug?: string; status?: string; description?: string } | null;
  totals: {
    projects: number;
    activeProjects: number;
    issues: number;
    activeIssues: number;
    reviewIssues: number;
    todoIssues: number;
    blockedIssues: number;
    doneIssues: number;
    agents: number;
    activeAgents: number;
    progress: number;
    agentOwned: number;
    humanOwned: number;
    liveRuns: number;
    requests: number;
  };
  buckets: {
    active: number;
    review: number;
    todo: number;
    blocked: number;
    done: number;
  };
  room: {
    zones: Array<{ id: string; label: string; x: number; y: number; workCount: number }>;
    agents: SpliceWorkspaceRoomActor[];
    humans: SpliceWorkspaceRoomActor[];
  };
  lanes: {
    active: SpliceWorkspaceRoomWorkItem[];
    review: SpliceWorkspaceRoomWorkItem[];
    next: SpliceWorkspaceRoomWorkItem[];
    blocked: SpliceWorkspaceRoomWorkItem[];
  };
  projects: SpliceWorkspaceRoomProject[];
  agents: SpliceWorkspaceRoomActor[];
  activity: Array<{
    id: string;
    type: "project" | "issue";
    title: string;
    status: string;
    ownerName: string;
    ageMin: number | null;
  }>;
  requests: SpliceAgentRunRequest[];
}

export const spliceApi = {
  overview: () => api.get<SpliceOverviewData>("/splice/overview"),
  workspaceRoom: (workspaceId: string) =>
    api.get<SpliceWorkspaceRoomData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/room`),
  puzzleRoom: () => api.get<SpliceWorkspaceRoomData>("/splice/puzzle-room"),
  runAgent: (companyId: string, agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  runPuzzleAgent: (agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/puzzle-room/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  runWorkspaceRoomAgent: (workspaceId: string, agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  dispatchRunner: () => api.post<SpliceRunnerDispatch>("/splice/runner/dispatch", {}),
};
