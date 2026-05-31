import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: { size: string } }
) {
  const size = Math.min(Math.max(parseInt(params.size) || 192, 48), 512);
  const r = Math.round(size * 0.18); // border-radius

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "linear-gradient(145deg, #1C2B4A 0%, #2D4A7A 100%)",
          borderRadius: r,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: size * 0.04,
        }}
      >
        {/* 막대 그래프 아이콘 (favicon과 동일한 디자인) */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: size * 0.04 }}>
          <div style={{ width: size * 0.16, height: size * 0.28, background: "rgba(255,255,255,0.6)", borderRadius: size * 0.03 }} />
          <div style={{ width: size * 0.16, height: size * 0.44, background: "rgba(255,255,255,0.8)", borderRadius: size * 0.03 }} />
          <div style={{ width: size * 0.16, height: size * 0.60, background: "#ffffff", borderRadius: size * 0.03 }} />
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: size * 0.13,
            fontWeight: 700,
            letterSpacing: size * 0.004,
          }}
        >
          SW Admin
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
