"use client";

import { useEffect, useState } from "react";

// 포털 페이지들의 다크모드 토글이 켜져 있을 때 "portal-dark-change" 커스텀 이벤트를 쏘아준다.
// 어드민의 useAdminDarkMode와 동일한 패턴 — 인라인 style로 색상을 직접 계산하는
// 컴포넌트가 prop 없이도 다크모드 상태를 즉시 읽을 수 있도록 하기 위한 훅.
export function usePortalDarkMode(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("portal-dark");
    if (saved !== null) return saved === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    function handleChange(e: Event) {
      setDark((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener("portal-dark-change", handleChange);
    return () => window.removeEventListener("portal-dark-change", handleChange);
  }, []);

  return dark;
}
