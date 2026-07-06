"use client";

import { toast } from "sonner";
import { useDealStore } from "@/store/dealStore";
import type { ChatProposal, ProposedChange, DealStatus } from "@/types";

async function applyChange(dealId: string, change: ProposedChange): Promise<void> {
  const state = useDealStore.getState();
  const p = change.payload;

  switch (change.type) {
    case "loi_draft": {
      if (!p.loiDraft) throw new Error("Missing LOI draft payload");
      const res = await fetch(`/api/deals/${dealId}/loi/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: p.loiDraft.sections,
          terms: p.loiDraft.terms,
          source: "chat",
        }),
      });
      if (!res.ok) throw new Error("Failed to save LOI version");
      const { version } = await res.json();
      state.setLOIVersions([...useDealStore.getState().loiVersions, version]);
      state.setActiveLoiVersionId(version.id);
      state.setLOI({
        id: version.id,
        deal_id: dealId,
        terms: version.terms,
        sections: version.sections,
        generated_at: version.created_at,
        sent_at: null,
        created_at: version.created_at,
        updated_at: version.updated_at,
      });
      state.updateDeal(dealId, { loi_state: "draft" });
      toast.success(`LOI saved as ${version.label} → switch to LOI tab to review`);
      return;
    }

    case "loi_term": {
      const loi = state.loi;
      if (!loi || !p.termId) throw new Error("No LOI loaded or missing termId");
      const updatedTerms = loi.terms.map((t) =>
        t.id === p.termId ? { ...t, value: p.termValue ?? change.newValue } : t
      );
      const res = await fetch(`/api/deals/${dealId}/loi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: updatedTerms }),
      });
      if (!res.ok) throw new Error("Failed to update LOI term");
      state.setLOI({ ...loi, terms: updatedTerms });
      toast.success(`${change.label} updated to ${change.newValue}`);
      return;
    }

    case "data_field": {
      const field = p.fieldId
        ? state.dataFields.find((f) => f.id === p.fieldId)
        : state.dataFields.find((f) => f.field_key === p.fieldKey);
      if (!field) throw new Error(`Data field not found: ${p.fieldKey ?? p.fieldId}`);
      const updates: Record<string, unknown> = {
        field_value: p.fieldValue ?? change.newValue,
      };
      if (p.fieldValueNumeric !== undefined) {
        updates.field_value_numeric = p.fieldValueNumeric;
      }
      const res = await fetch(`/api/deals/${dealId}/data-fields/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update data field");
      const { field: updated } = await res.json();
      state.updateDataField(field.id, updated);
      toast.success(`${change.label} updated to ${change.newValue}`);
      return;
    }

    case "unit": {
      if (!p.unitId) throw new Error("Missing unitId");
      const updates: Record<string, unknown> = {};
      if (p.unitRent !== undefined) updates.current_rent = p.unitRent;
      if (p.unitStatus !== undefined) updates.status = p.unitStatus;
      const res = await fetch(`/api/deals/${dealId}/units/${p.unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update unit");
      const { unit } = await res.json();
      state.updateUnit(p.unitId, unit);
      toast.success(`Unit ${unit?.unit_number ?? ""} updated`);
      return;
    }

    case "deal_status": {
      if (!p.dealStatus) throw new Error("Missing dealStatus");
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: p.dealStatus }),
      });
      if (!res.ok) throw new Error("Failed to update deal status");
      state.updateDeal(dealId, { status: p.dealStatus as DealStatus });
      toast.success(`Deal status updated to ${p.dealStatus.replace(/_/g, " ")}`);
      return;
    }

    case "notes": {
      if (p.notesContent === undefined) throw new Error("Missing notes content");
      const res = await fetch(`/api/deals/${dealId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: p.notesContent }),
      });
      if (!res.ok) throw new Error("Failed to update notes");
      toast.success("Notes updated");
      return;
    }
  }
}

function persistProposal(
  dealId: string,
  proposalId: string,
  status: ChatProposal["status"],
  appliedChangeIds: string[]
) {
  return fetch(`/api/deals/${dealId}/chat`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposalId, status, appliedChangeIds }),
  }).catch(() => {});
}

export function useApplyProposal(dealId: string) {
  const updateProposal = useDealStore((s) => s.updateProposal);

  async function applyChanges(
    proposal: ChatProposal,
    selectedChangeIds: string[]
  ): Promise<void> {
    const selected = proposal.changes.filter((c) =>
      selectedChangeIds.includes(c.id)
    );
    const appliedIds: string[] = [];
    for (const change of selected) {
      try {
        await applyChange(dealId, change);
        appliedIds.push(change.id);
      } catch (e) {
        toast.error(
          `Failed to apply "${change.label}": ${e instanceof Error ? e.message : "unknown error"}`
        );
      }
    }

    const status: ChatProposal["status"] =
      appliedIds.length === proposal.changes.length
        ? "applied"
        : "partially_applied";
    updateProposal(proposal.id, { status, appliedChangeIds: appliedIds });
    await persistProposal(dealId, proposal.id, status, appliedIds);
  }

  async function rejectProposal(proposal: ChatProposal): Promise<void> {
    updateProposal(proposal.id, { status: "rejected" });
    await persistProposal(dealId, proposal.id, "rejected", []);
  }

  return { applyChanges, rejectProposal };
}
