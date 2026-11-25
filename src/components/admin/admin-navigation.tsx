"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Camera, Car, ClipboardList, LayoutDashboard, MapPin, Settings, Shield, Sparkles, Users, KeyRound } from "lucide-react";

import type { AdminRole } from "@/lib/auth/roles";

const groups = [
  { label: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { label: "Parking Operations", items: [
    { href: "/admin/zones", label: "Parking Zones", icon: MapPin },
    { href: "/admin/cameras", label: "Cameras", icon: Camera },
    { href: "/admin/monitor", label: "Monitoring", icon: Activity },
  ] },
  { label: "Management", items: [
    { href: "/admin/vehicle-approvals", label: "Vehicle Approvals", icon: Car },
    { href: "/admin/policies", label: "Policy Management", icon: ClipboardList },
    { href: "/admin/smart-campus", label: "Smart Campus", icon: Sparkles },
  ] },
];

const superAdminGroup = { label: "System Administration", items: [
  { href: "/admin/accounts", label: "Admin Management", icon: Users },
  { href: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
  { href: "/admin/settings", label: "System Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Shield },
] };

export function AdminNavigation({ role, authOnly }: { role: AdminRole; authOnly: boolean }) {
  const visibleGroups = authOnly ? [{ ...groups[0], items: groups[0].items.slice(0, 1) }] : groups;
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">
        <span className="admin-emblem" aria-hidden="true">MFU</span>
        <span><strong>MFU Smart<br />Parking</strong><small>Mae Fah Luang University</small></span>
      </Link>
      <nav aria-label="Admin navigation">
        {(role === "super_admin" ? [...visibleGroups, superAdminGroup] : visibleGroups).map((group) => (
          <div key={group.label} className="admin-nav-group">
            <p>{group.label}</p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));
              return (
                <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? (pathname === href ? "page" : "location") : undefined}>
                  <Icon size={18} aria-hidden="true" />{label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
