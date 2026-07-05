"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useDealStore } from "@/store/dealStore";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading2,
} from "lucide-react";

const DEFAULT_NOTE_TEMPLATE = `<h1>Deal Notes</h1>

<h2>Selling points / thesis</h2>
<p></p>

<h2>Questions for the seller</h2>
<ul><li></li></ul>

<h2>Email drafts</h2>
<p></p>

<h2>Due-diligence checklist</h2>
<ul>
<li>T12 trailing statement</li>
<li>Rent roll (current signed leases)</li>
<li>Last 12 months bank statements</li>
<li>2025 tax bills</li>
<li>Insurance declaration page</li>
<li>Utility history (12 months)</li>
<li>Title / payoff confirmation</li>
</ul>

<h2>Negotiation notes</h2>
<p></p>`;

const SECTIONS = [
  "Selling points / thesis",
  "Questions for the seller",
  "Email drafts",
  "Due-diligence checklist",
  "Negotiation notes",
];

export function DealNotes() {
  const { activeDeal } = useDealStore();

  const dealId = activeDeal?.id ?? null;
  const storageKey = dealId ? `dealdesk_notes_${dealId}` : null;

  // Refs so the (stable) tiptap onUpdate closure always sees the current deal
  const dealIdRef = useRef<string | null>(null);
  dealIdRef.current = dealId;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing deal notes…",
      }),
      Link.configure({ openOnClick: false }),
    ],
    content: DEFAULT_NOTE_TEMPLATE,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate: ({ editor }) => {
      const id = dealIdRef.current;
      if (!id) return;
      const html = editor.getHTML();
      try {
        localStorage.setItem(`dealdesk_notes_${id}`, html);
      } catch {
        // storage full or blocked
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/deals/${id}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        }).catch(() => {});
      }, 1200);
    },
  });

  // Load content when deal changes: local user edits win, then DB
  // (which may hold AI-generated DD notes), then the blank template.
  useEffect(() => {
    if (!editor || !dealId || !storageKey) return;
    let cancelled = false;

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    if (saved) {
      editor.commands.setContent(saved);
      return;
    }

    fetch(`/api/deals/${dealId}/notes`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        editor.commands.setContent(data.note?.content || DEFAULT_NOTE_TEMPLATE);
      })
      .catch(() => {
        if (!cancelled) editor.commands.setContent(DEFAULT_NOTE_TEMPLATE);
      });

    return () => {
      cancelled = true;
    };
  }, [editor, dealId, storageKey]);

  const scrollToSection = useCallback(
    (label: string) => {
      if (!editor) return;
      const el = document.querySelector(
        `.tiptap-editor h2`
      ) as HTMLElement | null;
      // Find the heading with matching text
      document.querySelectorAll(".tiptap-editor h2").forEach((heading) => {
        if (heading.textContent === label) {
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    },
    [editor]
  );

  if (!activeDeal) {
    return (
      <div className="flex items-center justify-center h-full text-[#9b978f] text-[13px]">
        Select a deal to view its notes.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* TOC sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0 w-[200px] border-r border-[#e6e3dc] bg-white overflow-y-auto p-3.5">
        <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9b978f] mb-2.5 px-1">
          Outline
        </div>
        {SECTIONS.map((section) => (
          <button
            key={section}
            onClick={() => scrollToSection(section)}
            className="text-[12.5px] text-[#5a564e] px-3 py-2 rounded-[8px] hover:bg-[#f4f2eb] hover:text-[#23211d] text-left transition-colors w-full"
          >
            {section}
          </button>
        ))}
        <div className="mt-auto pt-3 px-1 text-[11px] text-[#b3aea3] border-t border-[#eee9df]">
          Edits auto-save locally.
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#efece4]">
        {/* Toolbar */}
        {editor && (
          <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-[#e6e3dc] flex-shrink-0">
            {[
              {
                icon: Bold,
                action: () => editor.chain().focus().toggleBold().run(),
                active: editor.isActive("bold"),
                title: "Bold",
              },
              {
                icon: Italic,
                action: () => editor.chain().focus().toggleItalic().run(),
                active: editor.isActive("italic"),
                title: "Italic",
              },
              {
                icon: Heading2,
                action: () =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run(),
                active: editor.isActive("heading", { level: 2 }),
                title: "Heading",
              },
              {
                icon: List,
                action: () => editor.chain().focus().toggleBulletList().run(),
                active: editor.isActive("bulletList"),
                title: "Bullet list",
              },
              {
                icon: ListOrdered,
                action: () => editor.chain().focus().toggleOrderedList().run(),
                active: editor.isActive("orderedList"),
                title: "Numbered list",
              },
            ].map(({ icon: Icon, action, active, title }) => (
              <button
                key={title}
                onClick={action}
                title={title}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-[6px] transition-colors cursor-pointer",
                  active
                    ? "bg-[#2f5d5014] text-[#2f5d50]"
                    : "text-[#6b6862] hover:bg-[#f4f2eb] hover:text-[#23211d]"
                )}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto px-5 py-7">
          <div className="max-w-[760px] mx-auto bg-white border border-[#e6e3dc] rounded-[4px] shadow-sm min-h-[920px] px-[clamp(20px,5%,64px)] py-[52px]">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
