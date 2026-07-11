"use client";

import { useState } from "react";
import { useAdminDarkMode } from "@/lib/use-admin-dark-mode";

export interface FilterOption<T extends string = string> {
  key: T;
  label: string;
}

interface FilterBarProps<T extends string = string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

// 공용 필터 바 — 기본은 접힌 상태(선택된 필터 라벨 + "필터 ▾" 토글)로 시작하고,
// 클릭하면 전체 칩 목록이 펼쳐진다. 단일 선택 전용, 상태는 로컬로만 유지한다.
export default function FilterBar<T extends string = string>({ options, value, onChange }: FilterBarProps<T>) {
  const dark = useAdminDarkMode();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);

  const idleStyle = { background: dark ? "#18181B" : "#F4F4F5", color: dark ? "#A1A1AA" : "#52525B" };
  const activeStyle = { background: "var(--admin-accent)", color: "#fff" };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
        style={idleStyle}
      >
        필터 {open ? "▴" : "▾"}
      </button>

      {!open && selected && (
        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={activeStyle}>
          {selected.label}
        </span>
      )}

      {open && options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
          style={o.key === value ? activeStyle : idleStyle}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
