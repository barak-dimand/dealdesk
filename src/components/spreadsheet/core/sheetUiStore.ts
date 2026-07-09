import { create } from "zustand";
import type { Density } from "./types";

/**
 * Bridges the SheetToolbar (rendered in SpreadsheetView) and whichever
 * SpreadsheetEngine instance is currently mounted for the active tab.
 * The engine registers an imperative API on mount and clears it on unmount.
 */
export interface EngineApi {
  openFind: () => void;
  exportCsv: () => void;
  exportXlsx: () => void;
  addRow?: () => void;
  getColumnToggles: () => Array<{ id: string; label: string; visible: boolean }>;
  toggleColumn: (id: string) => void;
}

interface SheetUiState {
  density: Density;
  setDensity: (d: Density) => void;
  engineApi: EngineApi | null;
  setEngineApi: (api: EngineApi | null) => void;
}

export const useSheetUiStore = create<SheetUiState>((set) => ({
  density: "comfortable",
  setDensity: (density) => set({ density }),
  engineApi: null,
  setEngineApi: (engineApi) => set({ engineApi }),
}));
