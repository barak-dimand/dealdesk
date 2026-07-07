"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Home,
  ClipboardList,
  Landmark,
  Users,
  Handshake,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DealRail } from "@/components/deals/DealRail";
import { SettingsModal } from "@/components/settings/SettingsModal";

const STORAGE_KEY = "dealdesk_sidebar";

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_TOP: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: <Home size={16} /> },
];

const NAV_SECTIONS: NavItem[] = [
  { key: "opportunities", label: "Opportunities", href: "/opportunities", icon: <ClipboardList size={16} /> },
  { key: "portfolio", label: "Portfolio", href: "/portfolio", icon: <Landmark size={16} /> },
  { key: "crm", label: "CRM", href: "/crm", icon: <Users size={16} /> },
  { key: "buyers", label: "Buyers", href: "/buyers", icon: <Handshake size={16} /> },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const row = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center h-[34px] rounded-[8px] px-[10px] text-[13px] font-medium transition-colors",
        active
          ? "bg-[#2f5d5014] text-[#2f5d50]"
          : "text-[#3a3833] hover:bg-[#f6f5f1]",
        collapsed && "justify-center px-0"
      )}
    >
      <span className={cn("flex-shrink-0", !collapsed && "mr-[10px]")}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return row;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{row}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={6}
          className="bg-[#23211d] text-white text-[11.5px] px-2.5 py-1.5 rounded-[6px] shadow-md z-50"
        >
          {item.label}
          <Tooltip.Arrow className="fill-[#23211d]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function SubLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center h-[30px] rounded-[8px] pl-[36px] pr-[10px] text-[12.5px] transition-colors",
        active ? "text-[#2f5d50] font-semibold" : "text-[#6b6862] hover:bg-[#f6f5f1]"
      )}
    >
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  // Lazy initializer: reads localStorage once at mount (SSR-safe guard)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "collapsed";
    } catch {
      return false;
    }
  });

  // Auth pages render without app chrome
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    return null;
  }

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // storage blocked
    }
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <aside
        className="hidden md:flex flex-col flex-shrink-0 bg-white border-r border-[#e6e3dc] h-full overflow-hidden transition-[width] duration-150"
        style={{ width: collapsed ? 56 : 220 }}
      >
        {/* Brand / top nav */}
        <div className="flex flex-col gap-[2px] px-2 pt-3">
          {NAV_TOP.map((item) => (
            <NavRow
              key={item.key}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="border-t border-[#eee9df] my-2.5 mx-2" />

        {/* Sections */}
        {!collapsed && (
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#9b978f]">
            Workspace
          </div>
        )}
        <div className="flex flex-col gap-[2px] px-2 min-h-0 overflow-y-auto flex-1">
          {NAV_SECTIONS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <div key={item.key} className="flex flex-col">
                <NavRow item={item} active={active} collapsed={collapsed} />
                {/* Sub-items — only when section is active and sidebar expanded */}
                {!collapsed && active && item.key === "opportunities" && (
                  <div className="max-h-[40vh] overflow-y-auto border-b border-[#f4f2eb] mb-1">
                    <DealRail />
                  </div>
                )}
                {!collapsed && active && item.key === "portfolio" && (
                  <div className="pl-[36px] py-1.5 text-[11.5px] text-[#b3aea3] italic">
                    No assets yet
                  </div>
                )}
                {!collapsed && active && item.key === "crm" && (
                  <SubLink href="/crm/contacts" label="Contacts" />
                )}
                {!collapsed && active && item.key === "buyers" && (
                  <SubLink href="/buyers" label="Buyer List" />
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#eee9df] my-2 mx-2" />

        {/* Settings + collapse toggle */}
        <div className="flex flex-col gap-[2px] px-2 pb-3">
          <SettingsModal
            trigger={
              <button
                className={cn(
                  "flex items-center h-[34px] rounded-[8px] px-[10px] text-[13px] font-medium text-[#3a3833] hover:bg-[#f6f5f1] transition-colors cursor-pointer w-full",
                  collapsed && "justify-center px-0"
                )}
              >
                <span className={cn("flex-shrink-0", !collapsed && "mr-[10px]")}>
                  <Settings size={16} />
                </span>
                {!collapsed && <span>Settings</span>}
              </button>
            }
          />
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center h-[30px] rounded-[8px] px-[10px] text-[12px] text-[#9b978f] hover:bg-[#f6f5f1] hover:text-[#23211d] transition-colors cursor-pointer",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span className="ml-[10px]">Collapse</span>}
          </button>
        </div>
      </aside>
    </Tooltip.Provider>
  );
}
