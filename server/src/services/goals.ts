import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goals, companies } from "@paperclipai/db";

// fork_mangoclaw: zero-pad helper for identifiers. Goals use 3 digits ("001").
function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

type GoalReader = Pick<Db, "select">;

export async function getDefaultCompanyGoal(db: GoalReader, companyId: string) {
  const activeRootGoal = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.level, "company"),
        eq(goals.status, "active"),
        isNull(goals.parentId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
  if (activeRootGoal) return activeRootGoal;

  const anyRootGoal = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.level, "company"),
        isNull(goals.parentId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
  if (anyRootGoal) return anyRootGoal;

  return db
    .select()
    .from(goals)
    .where(and(eq(goals.companyId, companyId), eq(goals.level, "company")))
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
}

export function goalService(db: Db) {
  // fork_mangoclaw: declare svc with let so update() can self-reference for cascade recursion.
  // eslint-disable-next-line prefer-const
  let svc: ReturnType<typeof buildGoalService>;
  function buildGoalService() {
    return {
      // fork_mangoclaw: order by sort_order first (user-controllable), createdAt as tiebreaker.
      list: (companyId: string) =>
        db
          .select()
          .from(goals)
          .where(eq(goals.companyId, companyId))
          .orderBy(asc(goals.sortOrder), asc(goals.createdAt)),

      getById: (id: string) =>
        db
          .select()
          .from(goals)
          .where(eq(goals.id, id))
          .then((rows) => rows[0] ?? null),

      getDefaultCompanyGoal: (companyId: string) => getDefaultCompanyGoal(db, companyId),

      create: async (companyId: string, data: Omit<typeof goals.$inferInsert, "companyId">) => {
        // fork_mangoclaw: auto-assign identifier (counter+prefix) and sort_order
        // inside a transaction. Mirrors the issues.ts pattern at L4165-4182.
        return db.transaction(async (tx) => {
          // Self-correcting counter prevents identifier collisions if the
          // counter has drifted below the actual max.
          const [maxRow] = await tx
            .select({ maxNum: sql<number>`coalesce(max(${goals.goalNumber}), 0)` })
            .from(goals)
            .where(eq(goals.companyId, companyId));
          const currentMax = maxRow?.maxNum ?? 0;

          const [company] = await tx
            .update(companies)
            .set({ goalCounter: sql`greatest(${companies.goalCounter}, ${currentMax}) + 1` })
            .where(eq(companies.id, companyId))
            .returning({ goalCounter: companies.goalCounter, goalPrefix: companies.goalPrefix });

          const goalNumber = company?.goalCounter ?? currentMax + 1;
          const prefix = company?.goalPrefix ?? "";
          const padded = padNumber(goalNumber, 3);
          const identifier = prefix ? `${prefix}-${padded}` : padded;

          // sort_order: place new goal at end of list within its company, sparse
          // increment (10) so users have room to insert between siblings later.
          let sortOrder = data.sortOrder;
          if (sortOrder === undefined || sortOrder === null) {
            const [maxSortRow] = await tx
              .select({ maxSort: sql<number>`coalesce(max(${goals.sortOrder}), 0)` })
              .from(goals)
              .where(eq(goals.companyId, companyId));
            sortOrder = (maxSortRow?.maxSort ?? 0) + 10;
          }

          const [row] = await tx
            .insert(goals)
            .values({ ...data, companyId, goalNumber, identifier, sortOrder })
            .returning();
          return row;
        });
      },

      update: async (id: string, data: Partial<typeof goals.$inferInsert>) => {
        const updated = await db
          .update(goals)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(goals.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);

        // fork_mangoclaw: cascade A2 — when a key_result reaches a terminal status,
        // check if all sibling KRs are also terminal. If so, mark the parent
        // objective as achieved (if it is active).
        // Infinite-recursion guard: we only cascade when data.status is explicitly
        // set in this call AND the parent is currently "active" (not already terminal).
        // So the recursive call on the parent will find parent.status !== "active"
        // and no further cascade fires.
        if (
          updated &&
          data.status !== undefined &&
          (updated.status === "achieved" || updated.status === "cancelled") &&
          updated.kind === "key_result" &&
          updated.parentId != null
        ) {
          try {
            const siblings = await db
              .select({ status: goals.status })
              .from(goals)
              .where(
                and(
                  eq(goals.companyId, updated.companyId),
                  eq(goals.parentId, updated.parentId),
                  eq(goals.kind, "key_result"),
                ),
              );
            const allTerminal = siblings.length > 0 &&
              siblings.every((s) => s.status === "achieved" || s.status === "cancelled");
            if (allTerminal) {
              const parent = await db
                .select({ id: goals.id, kind: goals.kind, status: goals.status })
                .from(goals)
                .where(eq(goals.id, updated.parentId!))
                .then((rows) => rows[0] ?? null);
              if (parent && parent.kind === "objective" && parent.status === "active") {
                await svc.update(parent.id, { status: "achieved" });
                console.log(
                  `[fork_mangoclaw:cascade] goal.cascade_achieved: objective ${parent.id} auto-achieved via KR ${updated.id}`,
                );
              }
            }
          } catch (err) {
            // Cascade failure must not fail the original PATCH.
            console.error("[fork_mangoclaw:cascade] A2 cascade error:", err);
          }
        }

        return updated;
      },

      remove: (id: string) =>
        db
          .delete(goals)
          .where(eq(goals.id, id))
          .returning()
          .then((rows) => rows[0] ?? null),
    };
  }
  svc = buildGoalService();
  return svc;
}
