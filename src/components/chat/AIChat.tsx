"use client";

import { useEffect, useRef, useState } from "react";
import { useDealStore } from "@/store/dealStore";
import { Brand } from "@/components/ui/Brand";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { ProposalCard } from "./ProposalCard";
import { useApplyProposal } from "@/hooks/useApplyProposal";
import { parseActionBlock } from "@/lib/parseActionBlock";
import type { DealMessage, ChatProposal } from "@/types";

const SUGGESTED_PROMPTS = [
  "What is the real NOI based on the documents?",
  "Compare seller-finance vs cash offer structures",
  "What documents am I still missing?",
  "Draft a seller-finance offer letter",
  "Analyze the debt service and cash flow",
];

function Message({ msg }: { msg: DealMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={cn(
        "flex gap-2 items-end",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-6 h-6 rounded-[6px] bg-[#2f5d50] flex items-center justify-center flex-shrink-0">
          <div className="w-[8px] h-[8px] bg-white rotate-45 rounded-[1px]" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] px-3 py-[10px] text-[13px] leading-[1.55] whitespace-pre-wrap",
          isUser
            ? "bg-[#2f5d50] text-white rounded-[13px_13px_4px_13px]"
            : "bg-[#f3f1ea] text-[#23211d] rounded-[13px_13px_13px_4px]"
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-6 h-6 rounded-[6px] bg-[#2f5d50] flex items-center justify-center flex-shrink-0">
        <div className="w-[8px] h-[8px] bg-white rotate-45 rounded-[1px]" />
      </div>
      <div className="bg-[#f3f1ea] px-[13px] py-[11px] rounded-[13px_13px_13px_4px] flex gap-1">
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="w-[6px] h-[6px] rounded-full bg-[#9b978f]"
            style={{
              animation: `blink 1.2s infinite ${delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AIChat() {
  const {
    activeDeal,
    messages,
    addMessage,
    isChatStreaming,
    setIsChatStreaming,
    proposals,
    addProposal,
  } = useDealStore();

  const { applyChanges, rejectProposal } = useApplyProposal(activeDeal?.id ?? "");

  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isChatStreaming, streamingContent, isGenerating]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !activeDeal || isChatStreaming) return;

    setInput("");

    const userMsg: DealMessage = {
      id: `user-${Date.now()}`,
      deal_id: activeDeal.id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);
    setIsChatStreaming(true);
    setIsGenerating(true);
    setHasStartedStreaming(false);
    setStreamingContent("");

    try {
      const res = await fetch(`/api/deals/${activeDeal.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let receivedProposal: ChatProposal | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE chunks
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.proposal) {
                receivedProposal = parsed.proposal as ChatProposal;
                continue;
              }
              const delta = parsed.delta?.text ?? parsed.choices?.[0]?.delta?.content ?? "";
              full += delta;
              if (full.length > 0) setHasStartedStreaming(true);
              // Hide the machine-readable <action> block while streaming
              setStreamingContent(full.split("<action>")[0]);
            } catch {
              full += data;
              if (full.length > 0) setHasStartedStreaming(true);
              setStreamingContent(full.split("<action>")[0]);
            }
          }
        }
      }

      const { message: cleanText } = parseActionBlock(full);
      const aiMsg: DealMessage = {
        id: `ai-${Date.now()}`,
        deal_id: activeDeal.id,
        role: "assistant",
        content: cleanText || "I processed your request.",
        created_at: new Date().toISOString(),
        proposal: receivedProposal ?? undefined,
      };
      addMessage(aiMsg);
      if (receivedProposal) addProposal(receivedProposal);
    } catch {
      const errMsg: DealMessage = {
        id: `ai-err-${Date.now()}`,
        deal_id: activeDeal.id,
        role: "assistant",
        content:
          "Sorry, I couldn't process that. Make sure your Anthropic API key is configured.",
        created_at: new Date().toISOString(),
      };
      addMessage(errMsg);
    } finally {
      setIsChatStreaming(false);
      setIsGenerating(false);
      setHasStartedStreaming(false);
      setStreamingContent("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }

  const welcomeMessage =
    activeDeal
      ? `I'm ready to analyze ${activeDeal.name}. Upload documents to get started, or ask me anything about this deal.`
      : "Select a deal to start analyzing.";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat header */}
      <div className="flex-shrink-0 flex items-center gap-[9px] px-3.5 py-3 border-b border-[#eae6dd] bg-white">
        <div className="w-[30px] h-[30px] rounded-[8px] bg-[#2f5d50] flex items-center justify-center flex-shrink-0">
          <div className="w-[11px] h-[11px] bg-white rotate-45 rounded-[2px]" />
        </div>
        <div className="flex flex-col leading-[1.2]">
          <span className="text-[13px] font-semibold">AI Analyst</span>
          <span className="text-[11px] text-[#9b978f]">
            Reads this deal&apos;s data &amp; documents
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatRef}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-3"
      >
        {/* Welcome */}
        {messages.length === 0 && (
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-[6px] bg-[#2f5d50] flex items-center justify-center flex-shrink-0">
              <div className="w-[8px] h-[8px] bg-white rotate-45 rounded-[1px]" />
            </div>
            <div className="max-w-[85%] bg-[#f3f1ea] text-[#23211d] px-3 py-[10px] text-[13px] leading-[1.55] rounded-[13px_13px_13px_4px]">
              {welcomeMessage}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const liveProposal = msg.proposal
            ? proposals.find((p) => p.id === msg.proposal!.id) ?? msg.proposal
            : null;
          return (
            <div key={msg.id} className="flex flex-col gap-2">
              <Message msg={msg} />
              {liveProposal && (
                <div className="ml-8 max-w-[85%]">
                  <ProposalCard
                    proposal={liveProposal}
                    onApply={(ids) => applyChanges(liveProposal, ids)}
                    onReject={() => rejectProposal(liveProposal)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {isGenerating && !hasStartedStreaming && <TypingIndicator />}

        {isChatStreaming && streamingContent ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 items-end">
              <div className="w-6 h-6 rounded-[6px] bg-[#2f5d50] flex items-center justify-center flex-shrink-0">
                <div className="w-[8px] h-[8px] bg-white rotate-45 rounded-[1px]" />
              </div>
              <div className="max-w-[85%] bg-[#f3f1ea] text-[#23211d] px-3 py-[10px] text-[13px] leading-[1.55] whitespace-pre-wrap rounded-[13px_13px_13px_4px]">
                {streamingContent}
                <span className="inline-block w-[2px] h-[14px] bg-[#9b978f] ml-0.5 animate-pulse align-middle" />
              </div>
            </div>
            {isGenerating && hasStartedStreaming && (
              <div className="ml-8 flex items-center gap-1.5 text-[11px] text-[#9b978f]">
                <span
                  className="w-[5px] h-[5px] rounded-full bg-[#9b978f] flex-shrink-0"
                  style={{ animation: "pulseDot 1s ease-in-out infinite" }}
                />
                generating response...
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-3 py-2.5 border-t border-[#eae6dd] bg-white">
        {/* Suggested prompts */}
        <div className="flex gap-1.5 overflow-x-auto pb-2.5 scrollbar-hide">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => send(prompt)}
              disabled={isChatStreaming || !activeDeal}
              className="flex-shrink-0 text-[11.5px] px-[11px] py-1.5 rounded-[8px] bg-[#f6f4ee] border border-[#e6e3dc] text-[#3a3833] hover:bg-[#f0ede4] transition-colors disabled:opacity-40 whitespace-nowrap cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask, inquire, or tell the AI to update the sheet…"
            disabled={!activeDeal || isChatStreaming || isGenerating}
            className="flex-1 resize-none max-h-[120px] border border-[#e0dccf] rounded-[11px] px-3 py-[10px] text-[13px] text-[#23211d] placeholder-[#b3aea3] outline-none focus:border-[#2f5d50] transition-colors bg-[#faf8f3] disabled:opacity-50 leading-[1.4]"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || !activeDeal || isChatStreaming || isGenerating}
            className="w-[38px] h-[38px] flex-shrink-0 rounded-[10px] bg-[#2f5d50] text-white flex items-center justify-center hover:bg-[#274e43] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
