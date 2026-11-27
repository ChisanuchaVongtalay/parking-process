"use client";

import Link from "next/link";
import { Bell, Camera, CarFront, CheckCheck, ClipboardList } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminTime } from "@/lib/admin-time";
import type { AdminNotificationFeed } from "@/services/admin-notifications";

const icons = { vehicle: CarFront, camera: Camera, policy: ClipboardList };
const endpoint = "/api/admin/notifications";
const empty: AdminNotificationFeed = { items: [], unread: 0, latestId: 0, nextBefore: null };

export function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [feed, setFeed] = useState(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [extended, setExtended] = useState(false);
  const [revision, setRevision] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const requestFeed = useCallback(async (signal?: AbortSignal, before?: number) => {
    const params = new URLSearchParams({ unread: unreadOnly ? "1" : "0" });
    if (before) params.set("before", String(before));
    const response = await fetch(`${endpoint}?${params}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("โหลดการแจ้งเตือนไม่สำเร็จ");
    const { data } = await response.json() as { data: AdminNotificationFeed };
    return data;
  }, [unreadOnly]);

  useEffect(() => {
    if ((open && extended) || busy) return;
    let controller: AbortController | undefined;
    function refresh() {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      void requestFeed(current.signal).then((data) => {
        if (current.signal.aborted) return;
        setFeed(data);
        setError("");
      }).catch(() => {
        if (!current.signal.aborted) setError("โหลดการแจ้งเตือนไม่สำเร็จ");
      }).finally(() => {
        if (!current.signal.aborted) setLoading(false);
      });
    }

    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [open, extended, busy, revision, requestFeed]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function refresh() {
    setExtended(false);
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  async function loadOlder() {
    if (busy || feed.nextBefore === null) return;
    setBusy(true);
    setExtended(true);
    try {
      const next = await requestFeed(undefined, feed.nextBefore);
      setFeed((current) => ({ ...next, items: [...current.items, ...next.items] }));
      setError("");
    } catch {
      setError("โหลดการแจ้งเตือนก่อนหน้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(selection: { id: number } | { through: number }) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection), keepalive: true,
      });
      if (!response.ok) throw new Error("บันทึกสถานะไม่สำเร็จ");
      const at = Date.now();
      setFeed((current) => ({
        ...current,
        unread: "id" in selection ? Math.max(0, current.unread - 1) : 0,
        items: current.items.map((item) => {
          const matches = "id" in selection ? item.id === selection.id : item.id <= selection.through;
          return matches && item.readAt === null ? { ...item, readAt: at } : item;
        }).filter((item) => !unreadOnly || item.readAt === null),
      }));
      setError("");
    } catch {
      setError("บันทึกสถานะการอ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-notifications" ref={root}>
    <button
      type="button" ref={trigger} className="admin-notification-trigger"
      aria-label={feed.unread ? `การแจ้งเตือน ยังไม่อ่าน ${feed.unread} รายการ` : "การแจ้งเตือน"}
      aria-controls="admin-notification-feed" aria-expanded={open}
      onClick={() => {
        if (!open && extended) refresh();
        setOpen(!open);
      }}
    >
      <Bell size={19} aria-hidden="true" />
      {feed.unread > 0 && <span aria-hidden="true" className="admin-notification-count">{feed.unread > 99 ? "99+" : feed.unread}</span>}
    </button>
    {open && <section id="admin-notification-feed" className="admin-notification-panel" aria-labelledby="admin-notification-title">
      <div className="admin-notification-header">
        <h2 id="admin-notification-title">การแจ้งเตือน</h2>
        <button type="button" className="admin-link" disabled={busy || !feed.unread}
          onClick={() => void markRead({ through: feed.latestId })}>
          <CheckCheck size={16} aria-hidden="true" /> อ่านทั้งหมด
        </button>
      </div>
      <div className="admin-notification-filters">
        {[false, true].map((filter) => <button key={String(filter)} type="button" aria-pressed={unreadOnly === filter}
          disabled={busy} onClick={() => {
            if (unreadOnly === filter) return;
            setUnreadOnly(filter);
            setFeed((current) => ({ ...current, items: [], nextBefore: null }));
            refresh();
          }}>{filter ? "ยังไม่อ่าน" : "ทั้งหมด"}</button>)}
      </div>
      {error && <p role="alert" className="admin-notification-message">
        {error} <button type="button" className="admin-link" onClick={refresh}>ลองใหม่</button>
      </p>}
      <div className="admin-notification-list">
        {loading && !feed.items.length && <p role="status" className="admin-notification-message">กำลังโหลด…</p>}
        {!loading && !error && !feed.items.length &&
          <p className="admin-notification-message">{unreadOnly ? "ไม่มีการแจ้งเตือนที่ยังไม่อ่าน" : "ยังไม่มีการแจ้งเตือน"}</p>}
        {feed.items.map((item) => {
          const Icon = icons[item.category];
          return <Link className="admin-notification-item" key={item.id} href={item.href}
            data-unread={item.readAt === null} onClick={() => {
              if (item.readAt === null) void markRead({ id: item.id });
              setOpen(false);
            }}>
            <span className={`admin-notification-icon ${item.category}`}><Icon size={17} aria-hidden="true" /></span>
            <span className="min-w-0">
              <strong>{item.title}{item.readAt === null && <span className="sr-only"> (ยังไม่อ่าน)</span>}</strong>
              {item.detail && <span className="admin-notification-detail">{item.detail}</span>}
              <time dateTime={new Date(item.createdAt).toISOString()}>{adminTime(item.createdAt)}</time>
            </span>
            {item.readAt === null && <span className="admin-notification-dot" aria-hidden="true" />}
          </Link>;
        })}
      </div>
      {feed.nextBefore !== null && <button type="button" className="admin-notification-more admin-link" disabled={busy}
        onClick={() => void loadOlder()}>โหลดรายการก่อนหน้า</button>}
    </section>}
  </div>;
}
