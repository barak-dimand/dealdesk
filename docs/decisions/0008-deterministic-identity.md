# ADR-0008 — External identifiers over inference; aliases are confirmed, never guessed

**Status:** Accepted · 2026-08-07

## Context
Attribution — deciding which property a bank row, bill, or invoice line belongs to — is the
highest-frequency operation in intake and the one where errors are silent.

The portfolio contains **376 Cedar, 380 Cedar, 344 Cedar Ave**, and **173 Cedar Ave**
(Easy Breezy's own registered address). Also 431 Elm and 7682 Elm; 52 Shenango and
121 Shenango. One building appears across documents as `1002 Webster`, `1002 Webster 101`,
`1002 Webster 102`, and `1002.5 Webster`.

Similarity scoring on this data will mis-attribute money, and will do so quietly.

## Decision
1. **`external_account`** — a counterparty's identifier for one of our things, mapped to
   property / unit / lease / obligation. Observed in real data: Buildium deposit refs
   (`CC-0802-BA6D4`, `ACH-0723-39B16`), Farmers policy refs (`5509955`, `1638132`,
   `4565067` — three distinct policies), City of Farrell utility accounts (`…8924`,
   `…8882`, `…9307`), Mercer County payment numbers. Utility account numbers also appear
   as blank fields in the standard lease.
2. **`property_alias`** — observed string → property, recording who confirmed it and when.
   **Populated only by confirmed matches. Never auto-created.**
3. Amount-and-date matching is a *fallback requiring confirmation*, never a default.

## Consequences
- Most bank rows self-attribute once the mapping exists; fuzzy matching becomes the
  exception.
- The alias table grows monotonically and gets better with use.
- Cost: a confirmation step the first time any new string is seen.

## Evidence
July 2026 contains three separate `$207.48` Buildium deposits on different dates. Amount
matching cannot disambiguate them; the reference ID can.
