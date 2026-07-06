"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LOITerm, LOISection } from "@/types";

interface UseAutoTermSyncOptions {
  dealId: string;
  terms: LOITerm[];
  sections: LOISection[];
  onSectionUpdate: (sectionId: string, newContent: string) => void;
  /** Resolved at PATCH fire time — lets callers target a specific LOI version */
  getPatchUrl?: () => string;
}

export function useAutoTermSync({
  dealId,
  terms,
  sections,
  onSectionUpdate,
  getPatchUrl,
}: UseAutoTermSyncOptions) {
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);

  // Keep refs so timer callbacks always read the latest values
  const termsRef = useRef<LOITerm[]>(terms);
  const sectionsRef = useRef<LOISection[]>(sections);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { termsRef.current = terms; }, [terms]);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  const syncTermChange = useCallback(
    (termId: string, newValue: string, oldValue: string | null) => {
      const term = termsRef.current.find((t) => t.id === termId);
      if (!term) return;

      let firstAffectedId: string | null = null;

      for (const sectionId of term.affected_section_ids) {
        const section = sectionsRef.current.find((s) => s.id === sectionId);
        if (!section) continue;

        // Simple string replacement: swap old display value for new one in section text
        let newContent = section.content;
        if (oldValue && oldValue.trim() && newValue.trim()) {
          newContent = newContent.split(oldValue).join(newValue);
        }
        onSectionUpdate(sectionId, newContent);

        if (!firstAffectedId) firstAffectedId = sectionId;
      }

      // Highlight the first affected section
      if (firstAffectedId) {
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        setHighlightedSectionId(firstAffectedId);
        highlightTimer.current = setTimeout(() => setHighlightedSectionId(null), 650);
      }

      // Debounced PATCH — reads latest terms from ref at fire time
      if (patchTimer.current) clearTimeout(patchTimer.current);
      patchTimer.current = setTimeout(() => {
        const url = getPatchUrl?.() ?? `/api/deals/${dealId}/loi`;
        fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terms: termsRef.current }),
        });
      }, 1000);
    },
    [dealId, onSectionUpdate, getPatchUrl]
  );

  return { syncTermChange, highlightedSectionId };
}
