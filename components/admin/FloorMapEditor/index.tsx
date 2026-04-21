import dynamic from "next/dynamic";

// Konva는 SSR 미지원 → 클라이언트 전용 로드
const MapEditor = dynamic(() => import("./MapEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      도면 편집기 로딩 중...
    </div>
  ),
});

// hasLayout: localStorage에 저장된 도면이 있는지 확인 (SSR safe — 서버에선 항상 false)
export function hasLayout(bldId: string, floorId: string): boolean {
  if (typeof window === "undefined") return false;
  try { return !!localStorage.getItem(`sw-floor-layout-${bldId}-${floorId}`); }
  catch { return false; }
}

export default MapEditor;
