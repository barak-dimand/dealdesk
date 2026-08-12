import type { CreateCounterpartyInput } from "@/domains/counterparties/schema";

/**
 * Real counterparties referenced in BUILD.md — not invented. Contact details
 * (email/phone/address) aren't given anywhere in the source material, so
 * they stay null rather than being fabricated.
 */
export const SAMPLE_COUNTERPARTIES: CreateCounterpartyInput[] = [
  {
    name: "Doug",
    kind: "management_co",
    email: null,
    phone: null,
    address: null,
    notes: "Local property manager; assistant Chris",
  },
  {
    name: "Leera Pest Control",
    kind: "contractor",
    email: null,
    phone: null,
    address: null,
    notes: null,
  },
];
