"use client";

import { useRef, useEffect } from "react";
import type { LOISection } from "@/types";

function highlightPlaceholders(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /\[([^\]]*)\]/g,
    '<span style="color:#a8473a;font-style:italic">[$1]</span>'
  );
}

interface LOIDocumentProps {
  sections: LOISection[];
  onSectionChange: (sectionId: string, content: string) => void;
  highlightedSectionId: string | null;
}

export function LOIDocument({
  sections,
  onSectionChange,
  highlightedSectionId,
}: LOIDocumentProps) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const focusedSectionId = useRef<string | null>(null);
  const highlightTimers = useRef<{ flash: ReturnType<typeof setTimeout> | null; clear: ReturnType<typeof setTimeout> | null }>({ flash: null, clear: null });

  // Sync DOM content when sections change (initial load or term sync)
  // Skip sections the user is currently editing to preserve cursor position
  useEffect(() => {
    for (const section of sections) {
      if (section.id === focusedSectionId.current) continue;
      const el = sectionRefs.current[section.id];
      if (el && el.innerText !== section.content) {
        el.innerHTML = highlightPlaceholders(section.content);
      }
    }
  }, [sections]);

  // Yellow flash on the affected section when a term changes
  useEffect(() => {
    if (!highlightedSectionId) return;
    const el = sectionRefs.current[highlightedSectionId];
    if (!el) return;

    if (highlightTimers.current.flash) clearTimeout(highlightTimers.current.flash);
    if (highlightTimers.current.clear) clearTimeout(highlightTimers.current.clear);

    el.style.transition = "none";
    el.style.backgroundColor = "#fffbcc";

    highlightTimers.current.flash = setTimeout(() => {
      el.style.transition = "background-color 600ms ease";
      el.style.backgroundColor = "transparent";
    }, 50);

    highlightTimers.current.clear = setTimeout(() => {
      el.style.backgroundColor = "";
      el.style.transition = "";
    }, 700);
  }, [highlightedSectionId]);

  function handleInput(sectionId: string, el: HTMLDivElement) {
    clearTimeout(debounceTimers.current[sectionId]);
    debounceTimers.current[sectionId] = setTimeout(() => {
      onSectionChange(sectionId, el.innerText);
    }, 400);
  }

  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-7 bg-[#efece4]">
      <div className="max-w-[760px] mx-auto bg-white border border-[#e6e3dc] rounded-[4px] shadow-sm min-h-[920px] px-[clamp(20px,5%,64px)] py-[52px]">
        {sorted.map((section, idx) => (
          <div key={section.id}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9b978f] mb-2 select-none">
              {section.label}
            </div>
            <div
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
              contentEditable
              suppressContentEditableWarning
              onFocus={() => {
                focusedSectionId.current = section.id;
              }}
              onBlur={() => {
                focusedSectionId.current = null;
              }}
              onInput={(e) => handleInput(section.id, e.currentTarget)}
              className="text-[15px] leading-[1.7] text-[#2a2823] outline-none whitespace-pre-wrap rounded-[4px] px-1 py-0.5 -mx-1 focus:bg-[#faf8f3] transition-colors"
              style={{ minHeight: "1.7em" }}
            />
            {idx < sorted.length - 1 && (
              <hr className="border-t border-[#ece9e2] my-5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
