"use client";

import { useEffect, useState } from "react";

// app/admin/page.tsx의 다크모드 토글이 켜져 있을 때 "admin-dark-change" 커스텀 이벤트를 쏘아준다.
// 인라인 style로 색상을 직접 계산하는 패널들(STAGE_COLORS 등)이 prop 없이도
// 다크모드 상태를 즉시 읽을 수 있도록 하기 위한 훅.
export function useAdminDarkMode(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("admin-dark");
    if (saved !== null) return saved === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    function handleChange(e: Event) {
      setDark((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener("admin-dark-change", handleChange);
    return () => window.removeEventListener("admin-dark-change", handleChange);
  }, []);

  return dark;
}
