import { create } from "zustand";
import type {
  LayoutMode,
  CenterTab,
  SheetTab,
  MobileTab,
  Deal,
  DealDocument,
  DealUnit,
  DealDataField,
  DealMessage,
  DealOfferStructure,
  DealRecommendation,
  DealLOI,
  ChatProposal,
  LOIVersion,
} from "@/types";

interface DealState {
  // UI state
  layout: LayoutMode;
  activeDealId: string | null;
  centerTab: CenterTab;
  sheetTab: SheetTab;
  mobileTab: MobileTab;
  dealMenuOpen: boolean;
  chatWidth: number;

  // Data
  deals: Deal[];
  activeDeal: Deal | null;
  documents: DealDocument[];
  units: DealUnit[];
  dataFields: DealDataField[];
  messages: DealMessage[];
  offerStructures: DealOfferStructure[];
  recommendation: DealRecommendation | null;
  loi: DealLOI | null;
  proposals: ChatProposal[];
  loiVersions: LOIVersion[];
  activeLoiVersionId: string | null;

  // Loading state
  isLoadingDeals: boolean;
  isLoadingDeal: boolean;
  isParsingDocument: string | null; // document id being parsed
  isChatStreaming: boolean;
  isGeneratingRec: boolean;

  // Actions
  setLayout: (layout: LayoutMode) => void;
  setActiveDealId: (id: string | null) => void;
  setCenterTab: (tab: CenterTab) => void;
  setSheetTab: (tab: SheetTab) => void;
  setMobileTab: (tab: MobileTab) => void;
  setDealMenuOpen: (open: boolean) => void;
  setChatWidth: (w: number) => void;

  setDeals: (deals: Deal[]) => void;
  setActiveDeal: (deal: Deal | null) => void;
  setDocuments: (docs: DealDocument[] | ((prev: DealDocument[]) => DealDocument[])) => void;
  setUnits: (units: DealUnit[]) => void;
  setDataFields: (fields: DealDataField[]) => void;
  setMessages: (messages: DealMessage[]) => void;
  addMessage: (message: DealMessage) => void;
  setOfferStructures: (offers: DealOfferStructure[]) => void;
  setRecommendation: (rec: DealRecommendation | null) => void;
  setLOI: (loi: DealLOI | null) => void;
  addProposal: (proposal: ChatProposal) => void;
  setProposals: (proposals: ChatProposal[]) => void;
  updateProposal: (id: string, updates: Partial<ChatProposal>) => void;
  setLOIVersions: (versions: LOIVersion[]) => void;
  setActiveLoiVersionId: (id: string | null) => void;

  setIsLoadingDeals: (v: boolean) => void;
  setIsLoadingDeal: (v: boolean) => void;
  setIsParsingDocument: (docId: string | null) => void;
  setIsChatStreaming: (v: boolean) => void;
  setIsGeneratingRec: (v: boolean) => void;

  updateDocumentStatus: (docId: string, status: DealDocument["status"]) => void;
  updateDocument: (docId: string, updates: Partial<DealDocument>) => void;
  addDeal: (deal: Deal) => void;
  addDocument: (doc: DealDocument) => void;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  addDataField: (field: DealDataField) => void;
  updateDataField: (id: string, updates: Partial<DealDataField>) => void;
  removeDataField: (id: string) => void;
  addUnit: (unit: DealUnit) => void;
  updateUnit: (id: string, updates: Partial<DealUnit>) => void;
  removeUnit: (id: string) => void;
}

export const useDealStore = create<DealState>((set) => ({
  layout: "command",
  activeDealId: null,
  centerTab: "sheet",
  sheetTab: "rentroll",
  mobileTab: "sheet",
  dealMenuOpen: false,
  chatWidth: 380,

  deals: [],
  activeDeal: null,
  documents: [],
  units: [],
  dataFields: [],
  messages: [],
  offerStructures: [],
  recommendation: null,
  loi: null,
  proposals: [],
  loiVersions: [],
  activeLoiVersionId: null,

  isLoadingDeals: false,
  isLoadingDeal: false,
  isParsingDocument: null,
  isChatStreaming: false,
  isGeneratingRec: false,

  setLayout: (layout) => set({ layout }),
  setActiveDealId: (id) => set({ activeDealId: id }),
  setCenterTab: (tab) => set({ centerTab: tab }),
  setSheetTab: (tab) => set({ sheetTab: tab }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setDealMenuOpen: (open) => set({ dealMenuOpen: open }),
  setChatWidth: (w) => set({ chatWidth: w }),

  setDeals: (deals) => set({ deals }),
  setActiveDeal: (deal) => set({ activeDeal: deal }),
  setDocuments: (documents) =>
    set((state) => ({
      documents: typeof documents === "function" ? documents(state.documents) : documents,
    })),
  setUnits: (units) => set({ units }),
  setDataFields: (dataFields) => set({ dataFields }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setOfferStructures: (offerStructures) => set({ offerStructures }),
  setRecommendation: (recommendation) => set({ recommendation }),
  setLOI: (loi) => set({ loi }),
  addProposal: (proposal) =>
    set((state) => ({ proposals: [...state.proposals, proposal] })),
  setProposals: (proposals) => set({ proposals }),
  updateProposal: (id, updates) =>
    set((state) => ({
      proposals: state.proposals.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  setLOIVersions: (loiVersions) => set({ loiVersions }),
  setActiveLoiVersionId: (activeLoiVersionId) => set({ activeLoiVersionId }),

  setIsLoadingDeals: (v) => set({ isLoadingDeals: v }),
  setIsLoadingDeal: (v) => set({ isLoadingDeal: v }),
  setIsParsingDocument: (docId) => set({ isParsingDocument: docId }),
  setIsChatStreaming: (v) => set({ isChatStreaming: v }),
  setIsGeneratingRec: (v) => set({ isGeneratingRec: v }),

  updateDocumentStatus: (docId, status) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === docId ? { ...d, status } : d
      ),
    })),
  updateDocument: (docId, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === docId ? { ...d, ...updates } : d
      ),
    })),

  addDeal: (deal) => set((state) => ({ deals: [deal, ...state.deals] })),
  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
  updateDeal: (id, updates) =>
    set((state) => ({
      deals: state.deals.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      activeDeal:
        state.activeDeal?.id === id
          ? { ...state.activeDeal, ...updates }
          : state.activeDeal,
    })),
  addDataField: (field) =>
    set((state) => ({ dataFields: [...state.dataFields, field] })),
  updateDataField: (id, updates) =>
    set((state) => ({
      dataFields: state.dataFields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),
  removeDataField: (id) =>
    set((state) => ({
      dataFields: state.dataFields.filter((f) => f.id !== id),
    })),
  addUnit: (unit) =>
    set((state) => ({ units: [...state.units, unit] })),
  updateUnit: (id, updates) =>
    set((state) => ({
      units: state.units.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    })),
  removeUnit: (id) =>
    set((state) => ({ units: state.units.filter((u) => u.id !== id) })),
}));
