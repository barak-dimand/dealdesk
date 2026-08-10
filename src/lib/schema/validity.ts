import { z } from "zod";

/**
 * Validity range for a relationship that can change over time without the prior state
 * being wrong (ADR-0002): property<->entity ownership, management agreements and their
 * fee rates, leases. `effective_to: null` means currently in force.
 */
export const validity = z.object({
  effective_from: z.iso.date(),
  effective_to: z.iso.date().nullable(),
});
export type Validity = z.infer<typeof validity>;
