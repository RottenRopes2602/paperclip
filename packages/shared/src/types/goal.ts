import type { GoalLevel, GoalStatus, GoalKind } from "../constants.js";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  status: GoalStatus;
  parentId: string | null;
  ownerAgentId: string | null;
  // fork_mangoclaw: auto-numbered identifier + manual sort_order (migration 0090).
  goalNumber?: number | null;
  identifier?: string | null;
  sortOrder?: number;
  // fork_mangoclaw: explicit goal kind (migration 0092).
  kind?: GoalKind | null;
  createdAt: Date;
  updatedAt: Date;
}
