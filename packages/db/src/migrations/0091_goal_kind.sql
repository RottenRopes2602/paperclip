-- fork_mangoclaw: explicit type for goals (mission/vision/objective/key_result).
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "kind" text;
CREATE INDEX IF NOT EXISTS "goals_company_kind_idx" ON "goals" ("company_id", "kind");
