import type { CreateEntityInput } from "@/domains/entities/schema";

/**
 * The four owning entities (BUILD.md §1, "The four owning entities"). Real
 * portfolio data, not invented — canonical fixture for the entities domain,
 * the same way CALVERT_* is canonical for deals.
 */
export const FOUR_ENTITIES: CreateEntityInput[] = [
  { name: "Easy Breezy LLC", entity_type: "llc", formation_state: "PA", status: "active" },
  { name: "Imagine Investments LLC", entity_type: "llc", formation_state: "PA", status: "active" },
  {
    name: "Everest Realty Solutions LLC",
    entity_type: "llc",
    formation_state: "OH", // ADR-0006: an Ohio LLC, operating in PA
    status: "winding_down",
  },
  { name: "Personal", entity_type: "personal", formation_state: null, status: "active" },
];
