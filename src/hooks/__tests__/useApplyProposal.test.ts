import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApplyProposal } from "../useApplyProposal";
import { useDealStore } from "@/store/dealStore";
import {
  CALVERT_DEAL,
  CALVERT_UNITS,
  CALVERT_DATA_FIELDS,
  CALVERT_PROPOSAL,
  CALVERT_LOI_DRAFT,
} from "@/test/fixtures";
import type {
  Deal,
  DealUnit,
  DealDataField,
  ChatProposal,
} from "@/types";

const DEAL_ID = "test-deal-calvert";
const PROPOSAL = CALVERT_PROPOSAL as unknown as ChatProposal;

const MOCK_VERSION = {
  id: "version-1",
  deal_id: DEAL_ID,
  version_number: 1,
  label: "v1 · From chat",
  source: "chat",
  sections: CALVERT_LOI_DRAFT.sections,
  terms: CALVERT_LOI_DRAFT.terms,
  loi_state: "draft",
  sent_at: null,
  created_at: "2026-07-06T10:00:00Z",
  updated_at: "2026-07-06T10:00:00Z",
};

function mockFetch() {
  const fn = vi.fn((url: string, _init?: RequestInit) => {
    if (url.includes("/loi/versions")) {
      return Promise.resolve({ ok: true, json: async () => ({ version: MOCK_VERSION }) });
    }
    if (url.includes("/data-fields/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          field: {
            ...CALVERT_DATA_FIELDS[3],
            field_value: "$72,000",
            field_value_numeric: 72000,
          },
        }),
      });
    }
    if (url.includes("/units/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          unit: { ...CALVERT_UNITS[5], current_rent: 82500, status: "leased" },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("useApplyProposal", () => {
  beforeEach(() => {
    useDealStore.setState({
      activeDeal: CALVERT_DEAL as unknown as Deal,
      units: CALVERT_UNITS as unknown as DealUnit[],
      dataFields: CALVERT_DATA_FIELDS as unknown as DealDataField[],
      deals: [CALVERT_DEAL as unknown as Deal],
      proposals: [PROPOSAL],
      loiVersions: [],
      activeLoiVersionId: null,
      loi: null,
    });
  });

  it("loi_draft change creates a new version and updates the store", async () => {
    const fetchFn = mockFetch();
    const { result } = renderHook(() => useApplyProposal(DEAL_ID));

    await act(async () => {
      await result.current.applyChanges(PROPOSAL, ["chg-3"]);
    });

    const versionCall = fetchFn.mock.calls.find(([url]) =>
      (url as string).includes("/loi/versions")
    )!;
    expect(versionCall[0]).toBe(`/api/deals/${DEAL_ID}/loi/versions`);
    const body = JSON.parse((versionCall[1] as RequestInit).body as string);
    expect(body.source).toBe("chat");
    expect(body.sections).toHaveLength(8);

    const state = useDealStore.getState();
    expect(state.loiVersions).toHaveLength(1);
    expect(state.activeLoiVersionId).toBe("version-1");
    expect(state.loi?.id).toBe("version-1");
    expect(state.activeDeal?.loi_state).toBe("draft");
  });

  it("data_field change calls the correct API and updates the store", async () => {
    const fetchFn = mockFetch();
    const { result } = renderHook(() => useApplyProposal(DEAL_ID));

    await act(async () => {
      await result.current.applyChanges(PROPOSAL, ["chg-1"]);
    });

    // reported_noi is fixture df4 — resolved by fieldKey
    const fieldCall = fetchFn.mock.calls.find(([url]) =>
      (url as string).includes("/data-fields/")
    )!;
    expect(fieldCall[0]).toBe(`/api/deals/${DEAL_ID}/data-fields/df4`);
    const body = JSON.parse((fieldCall[1] as RequestInit).body as string);
    expect(body.field_value_numeric).toBe(72000);

    const updated = useDealStore.getState().dataFields.find((f) => f.id === "df4");
    expect(updated?.field_value).toBe("$72,000");
    expect(updated?.field_value_numeric).toBe(72000);
  });

  it("unit change calls the correct API", async () => {
    const fetchFn = mockFetch();
    const { result } = renderHook(() => useApplyProposal(DEAL_ID));

    await act(async () => {
      await result.current.applyChanges(PROPOSAL, ["chg-2"]);
    });

    const unitCall = fetchFn.mock.calls.find(([url]) =>
      (url as string).includes("/units/")
    )!;
    expect(unitCall[0]).toBe(`/api/deals/${DEAL_ID}/units/u6`);
    const body = JSON.parse((unitCall[1] as RequestInit).body as string);
    expect(body.current_rent).toBe(82500);
    expect(body.status).toBe("leased");

    const updated = useDealStore.getState().units.find((u) => u.id === "u6");
    expect(updated?.current_rent).toBe(82500);
    expect(updated?.status).toBe("leased");
  });

  it("partial apply sets status to partially_applied", async () => {
    mockFetch();
    const { result } = renderHook(() => useApplyProposal(DEAL_ID));

    await act(async () => {
      await result.current.applyChanges(PROPOSAL, ["chg-1"]);
    });

    const proposal = useDealStore.getState().proposals.find(
      (p) => p.id === PROPOSAL.id
    );
    expect(proposal?.status).toBe("partially_applied");
    expect(proposal?.appliedChangeIds).toEqual(["chg-1"]);
  });

  it("full apply sets status to applied", async () => {
    mockFetch();
    const { result } = renderHook(() => useApplyProposal(DEAL_ID));

    await act(async () => {
      await result.current.applyChanges(PROPOSAL, ["chg-1", "chg-2", "chg-3"]);
    });

    const proposal = useDealStore.getState().proposals.find(
      (p) => p.id === PROPOSAL.id
    );
    expect(proposal?.status).toBe("applied");
    expect(proposal?.appliedChangeIds).toEqual(["chg-1", "chg-2", "chg-3"]);
  });
});
