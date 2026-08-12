import { z } from "zod";
import { pgTimestamptz } from "@/lib/schema/timestamp";

/**
 * One table for every kind of correspondent — management co, contractor,
 * insurer, city, court, housing authority, lender, investor, tenant, title
 * agent, broker, utility, buyer, seller. They all behave identically for
 * correspondence (BUILD.md §5, PHASE-1 Task 1). `crm_contacts` / `buyers`
 * remain acquisition-side; not merged this phase (ADR-0007 deferral stands).
 */
export const counterpartyKind = z.enum([
  "management_co",
  "contractor",
  "insurer",
  "city",
  "court",
  "housing_authority",
  "lender",
  "investor",
  "tenant",
  "title_agent",
  "broker",
  "utility",
  "buyer",
  "seller",
]);
export type CounterpartyKind = z.infer<typeof counterpartyKind>;

export const counterpartySchema = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  name: z.string().min(1),
  kind: counterpartyKind,
  email: z.email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: pgTimestamptz,
  updated_at: pgTimestamptz,
});
export type Counterparty = z.infer<typeof counterpartySchema>;

/** POST body — id/workspace_id/timestamps are server-assigned. */
export const createCounterpartyInput = counterpartySchema
  .omit({ id: true, workspace_id: true, created_at: true, updated_at: true })
  .extend({
    email: z.email().nullable().default(null),
    phone: z.string().nullable().default(null),
    address: z.string().nullable().default(null),
    notes: z.string().nullable().default(null),
  });
export type CreateCounterpartyInput = z.infer<typeof createCounterpartyInput>;
