"use client";

interface SyncBannerProps {
  lastSynced: string;
  notionUrl?: string;
  label?: string;
}

export function SyncBanner({ lastSynced, notionUrl, label = "노션 원본 보기" }: SyncBannerProps) {
  const date = lastSynced
    ? new Date(lastSynced).toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-5 text-xs text-gray-500">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
      <span>
        노션 데이터 기준: <strong className="text-gray-800">{date}</strong>
      </span>
      {notionUrl && (
        <a
          href={notionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-blue-600 font-semibold hover:underline"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          {label}
        </a>
      )}
    </div>
  );
}
