import { z } from "zod";
import { pgTimestamptz } from "@/lib/schema/timestamp";

export const entityType = z.enum(["llc", "personal"]);
export type EntityType = z.infer<typeof entityType>;

export const entityStatus = z.enum(["active", "winding_down", "dissolved"]);
export type EntityStatus = z.infer<typeof entityStatus>;

export const entitySchema = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  name: z.string().min(1),
  entity_type: entityType,
  formation_state: z.string().length(2).nullable(), // USPS 2-letter code; null for personal
  status: entityStatus,
  created_at: pgTimestamptz,
});
export type Entity = z.infer<typeof entitySchema>;

/** POST body — id/workspace_id/created_at are server-assigned. */
export const createEntityInput = entitySchema
  .omit({ id: true, workspace_id: true, created_at: true })
  .extend({
    entity_type: entityType.default("llc"),
    formation_state: z.string().length(2).nullable().default(null),
    status: entityStatus.default("active"),
  });
export type CreateEntityInput = z.infer<typeof createEntityInput>;
