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

export interface SpliceAgentMessage {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  agentId: string;
  agentName: string;
  author: "operator" | "agent" | string;
  kind: "instruction" | "message" | string;
  body: string;
  status: "queued" | "sent" | "done" | "failed" | string;
  createdAt: string;
  updatedAt: string;
  runRequestId: string | null;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceAgentMessagesData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  messages: SpliceAgentMessage[];
}

export interface SpliceAgentMessagePost {
  message: SpliceAgentMessage;
  runRequest: SpliceAgentRunRequest;
}

export interface SpliceWorkThreadEntry {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  itemType: "project" | "issue" | string;
  itemId: string;
  itemTitle: string;
  ownerName: string;
  author: "operator" | "agent" | string;
  status: "posted" | "saved" | "done" | "failed" | string;
  createdAt: string;
  updatedAt: string;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceWorkThreadComment extends SpliceWorkThreadEntry {
  body: string;
}

export interface SpliceWorkProduct extends SpliceWorkThreadEntry {
  kind: string;
  title: string;
  body: string;
}

export interface SpliceWorkThreadData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  comments: SpliceWorkThreadComment[];
  workProducts: SpliceWorkProduct[];
}

export interface SpliceWorkThreadCommentPost {
  comment: SpliceWorkThreadComment;
}

export interface SpliceWorkProductPost {
  workProduct: SpliceWorkProduct;
}

export interface SpliceReviewDecision {
  id: string;
  reviewId: string;
  workspaceId: string;
  workspaceName: string;
  itemType: "project" | "issue" | string;
  itemId: string;
  itemTitle: string;
  author: "operator" | "agent" | string;
  decision: "approved" | "changes_requested" | "rejected" | string;
  body: string;
  resultingStatus: string;
  createdAt: string;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceReview {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  itemType: "project" | "issue" | string;
  itemId: string;
  itemTitle: string;
  ownerName: string;
  requester: "operator" | "agent" | string;
  reviewerAgentId: string | null;
  reviewerAgentName: string | null;
  title: string;
  body: string;
  status: "requested" | "approved" | "changes_requested" | "rejected" | string;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisions: SpliceReviewDecision[];
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceReviewGateData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  reviews: SpliceReview[];
  decisions: SpliceReviewDecision[];
}

export interface SpliceReviewPost {
  review: SpliceReview;
}

export interface SpliceReviewDecisionPost {
  review: SpliceReview | null;
  decision: SpliceReviewDecision;
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

export interface SpliceAgentConsoleAgent extends SpliceWorkspaceRoomActor {
  requests: SpliceAgentRunRequest[];
  messages: SpliceAgentMessage[];
  lastEventAt: string | null;
}

export interface SpliceAgentConsoleData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePaths: {
    runRequests: string;
    messages: string;
  };
  agents: SpliceAgentConsoleAgent[];
  requests: SpliceAgentRunRequest[];
  messages: SpliceAgentMessage[];
}

export interface SpliceWorkspaceRoomGoal {
  slug: string;
  kind: "mission" | "vision" | "objective" | "key_result" | "goal" | string;
  level: string | null;
  name: string;
  status: string;
  parentGoalSlug: string | null;
  identifier: string | null;
  description: string | null;
}

export interface SpliceExecutionLane {
  id: string;
  name: string;
  kind: "main" | "worktree" | "codex" | "claude" | "conductor" | "agent" | string;
  kindLabel: string;
  state: "idle" | "active" | "dirty" | "ahead" | "queued" | "running" | "stale" | string;
  projectSpaceId: string;
  projectSpaceName: string;
  path: string;
  shortPath: string;
  branch: string;
  isMain: boolean;
  dirty: number;
  ahead: number;
  behind: number;
  lastCommit: { sha?: string; msg?: string; ageMin?: number } | null;
  requestCount: number;
  activeRequestCount: number;
  actors: Array<{
    id: string;
    name: string;
    kind: "human" | "agent" | string;
    state: string;
  }>;
}

export interface SpliceWorkspaceRoomData {
  generatedAt: string;
  id: string;
  name: string;
  mode: "single-workspace-live-room";
  path: string;
  shortPath: string;
  dataSource: string;
  objective: SpliceWorkspaceRoomGoal | null;
  goals: SpliceWorkspaceRoomGoal[];
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
    executionLanes?: number;
    activeExecutionLanes?: number;
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
  executionLanes: SpliceExecutionLane[];
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
  workspaceRoomMessages: (workspaceId: string) =>
    api.get<SpliceAgentMessagesData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/messages`),
  workspaceRoomAgentConsole: (workspaceId: string) =>
    api.get<SpliceAgentConsoleData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/agent-console`),
  sendWorkspaceRoomMessage: (workspaceId: string, agentId: string, body: string) =>
    api.post<SpliceAgentMessagePost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/messages`,
      { agentId, body },
    ),
  workspaceRoomWorkThread: (workspaceId: string) =>
    api.get<SpliceWorkThreadData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/work-thread`),
  createWorkspaceRoomComment: (workspaceId: string, input: { itemType: string; itemId: string; body: string }) =>
    api.post<SpliceWorkThreadCommentPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/work-thread/comments`,
      input,
    ),
  createWorkspaceRoomWorkProduct: (
    workspaceId: string,
    input: { itemType: string; itemId: string; title: string; body: string; kind?: string },
  ) =>
    api.post<SpliceWorkProductPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/work-thread/work-products`,
      input,
    ),
  workspaceRoomReviews: (workspaceId: string) =>
    api.get<SpliceReviewGateData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/reviews`),
  createWorkspaceRoomReview: (
    workspaceId: string,
    input: { itemType: string; itemId: string; title: string; body: string; reviewerAgentId?: string | null },
  ) =>
    api.post<SpliceReviewPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/reviews`,
      input,
    ),
  createWorkspaceRoomReviewDecision: (
    workspaceId: string,
    reviewId: string,
    input: { decision: "approved" | "changes_requested" | "rejected"; body: string },
  ) =>
    api.post<SpliceReviewDecisionPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/reviews/${encodeURIComponent(reviewId)}/decision`,
      input,
    ),
  dispatchRunner: (dryRun = false) =>
    api.post<SpliceRunnerDispatch>(`/splice/runner/dispatch${dryRun ? "?dryRun=1" : ""}`, {}),
};
