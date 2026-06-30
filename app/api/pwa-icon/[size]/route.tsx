import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { size: string } }
) {
  const size = Math.min(Math.max(parseInt(params.size) || 192, 48), 512);
  const r = Math.round(size * 0.18); // border-radius
  const origin = new URL(req.url).origin;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#ffffff",
          borderRadius: r,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${origin}/brand-mark.png`} width={size} height={size} />
      </div>
    ),
    { width: size, height: size }
  );
}
