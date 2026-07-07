"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ClipboardList, Landmark, Wrench, Users } from "lucide-react";
import type { Deal } from "@/types";

function SummaryCard({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 bg-white border border-[#e6e3dc] rounded-[12px] p-4 hover:border-[#2f5d5060] hover:shadow-[0_2px_10px_rgba(40,35,25,0.06)] transition-all"
    >
      <div className="flex items-center gap-2 text-[#9b978f]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <span className="text-[24px] font-semibold font-mono tracking-[-0.02em] text-[#23211d]">
        {value}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.deals) return;
        const active = (data.deals as Deal[]).filter(
          (d) => d.status !== "dead" && d.status !== "closed"
        );
        setActiveCount(active.length);
      })
      .catch(() => setActiveCount(0));
  }, []);

  const firstName = user?.firstName ?? null;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5f1]">
      <div className="max-w-[1000px] mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#23211d]">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[13px] text-[#9b978f] mt-1">
            Here&apos;s what&apos;s happening across your real estate business.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            href="/opportunities"
            icon={<ClipboardList size={14} />}
            label="Active Opportunities"
            value={activeCount != null ? String(activeCount) : "—"}
          />
          <SummaryCard
            href="/portfolio"
            icon={<Landmark size={14} />}
            label="Portfolio NOI"
            value="$0/mo"
          />
          <SummaryCard
            href="/portfolio"
            icon={<Wrench size={14} />}
            label="Open Maintenance"
            value="0 issues"
          />
          <SummaryCard
            href="/crm/contacts"
            icon={<Users size={14} />}
            label="CRM Contacts"
            value="0 contacts"
          />
        </div>

        {/* Recent activity */}
        <div className="bg-white border border-[#e6e3dc] rounded-[12px] p-5">
          <h2 className="text-[13px] font-semibold text-[#23211d] mb-3">
            Recent Activity
          </h2>
          <p className="text-[12.5px] text-[#b3aea3] italic py-6 text-center">
            No recent activity yet — activity from parsing, LOIs, and portfolio
            events will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
