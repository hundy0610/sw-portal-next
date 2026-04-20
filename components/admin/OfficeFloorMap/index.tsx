"use client";
import dynamic from "next/dynamic";

// react-konva는 SSR 불가 → dynamic import
const FloorMap = dynamic(
  () => import("./FloorMap").then((m) => ({ default: m.FloorMap })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse bg-slate-100 rounded-lg" /> },
);

export { FloorMap };
