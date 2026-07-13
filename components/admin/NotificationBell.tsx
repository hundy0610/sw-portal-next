"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { safeJson } from "@/lib/fetch-json";

type NotifCategory = "sw-expiry" | "asset-ready" | "return-due" | "helpdesk-new" | "weekly-feedback";

interface NotificationItem {
  id: string;
  category: NotifCategory;
  title: string;
  description: string;
  date?: string;
  severity: "urgent" | "warn" | "info";
  page: string;
  read: boolean;
}

interface Props {
  onNavigate: (page: string) => void;
}

const SEVERITY_STYLE: Record<NotificationItem["severity"], { text: string; dot: string; border: string }> = {
  urgent: { text: "text-red-600", dot: "bg-red-500", border: "border-l-red-500" },
  warn:   { text: "text-amber-700", dot: "bg-amber-500", border: "border-l-amber-500" },
  info:   { text: "text-blue-600", dot: "bg-blue-500", border: "border-l-blue-500" },
};

export default function NotificationBell({ onNavigate }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null); // null = 첫 폴링 전 (기존 알림은 팝업 안 띄움)

  const load = useCallback(async () => {
    try {
      const json = await fetch("/api/notifications").then(r => safeJson(r));
      if (json.ok) {
        const next: NotificationItem[] = json.notifications ?? [];
        setItems(next);
        setUnreadCount(json.unreadCount ?? 0);

        // 이전 폴링 이후 새로 나타난 항목만 하단 팝업으로 표시 (SW 갱신임박은 건수가 많아 팝업 제외, 벨 드롭다운에서만 확인)
        if (knownIdsRef.current) {
          const newOnes = next.filter(n => !n.read && n.category !== "sw-expiry" && !knownIdsRef.current!.has(n.id));
          if (newOnes.length > 0) {
            setToasts(prev => [...prev, ...newOnes.filter(n => !prev.some(p => p.id === n.id))]);
          }
        }
        knownIdsRef.current = new Set(next.map(n => n.id));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markRead = async (ids: string[]) => {
    const next = items.map(n => ids.includes(n.id) ? { ...n, read: true } : n);
    setItems(next);
    setUnreadCount(next.filter(n => !n.read).length);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    setItems(items.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch { /* silent */ }
  };

  const handleItemClick = (item: NotificationItem) => {
    onNavigate(item.page);
    if (!item.read) markRead([item.id]);
    setOpen(false);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const dismissAllToasts = () => {
    setToasts([]);
  };

  const handleToastClick = (item: NotificationItem) => {
    onNavigate(item.page);
    if (!item.read) markRead([item.id]);
    dismissToast(item.id);
  };

  return (
    <>
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
        title="알림"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-800">알림{items.length > 0 ? ` (${items.length})` : ""}</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">모두 읽음</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">새 알림이 없습니다.</div>
            ) : (
              items.map(item => {
                const s = SEVERITY_STYLE[item.severity];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-2.5 ${item.read ? "opacity-60" : ""}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        {!item.read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />}
                        <span className="text-xs font-semibold text-gray-800 truncate">{item.title}</span>
                      </span>
                      <span className={`block text-xs mt-0.5 ${s.text}`}>{item.description}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>

    {/* 신규 알림 팝업 — 화면 하단, 직접 닫기 전까지 유지 */}
    {toasts.length > 0 && (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.length > 1 && (
          <button
            onClick={dismissAllToasts}
            className="self-end px-2 py-1 text-xs text-gray-500 bg-white rounded-md shadow border border-gray-100 hover:bg-gray-50"
          >
            전체 닫기 ({toasts.length})
          </button>
        )}
        {toasts.map(item => {
          const s = SEVERITY_STYLE[item.severity];
          return (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow-2xl border border-gray-100 border-l-4 ${s.border} flex gap-2.5 items-start p-3`}
            >
              <button onClick={() => handleToastClick(item)} className="flex-1 min-w-0 text-left">
                <span className="text-xs font-semibold text-gray-800 block truncate">{item.title}</span>
                <span className={`text-xs mt-0.5 block ${s.text}`}>{item.description}</span>
              </button>
              <button
                onClick={() => dismissToast(item.id)}
                className="text-gray-300 hover:text-gray-500 text-sm leading-none shrink-0 px-0.5"
                title="닫기"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    )}
    </>
  );
}
