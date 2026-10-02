"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MONITOR_META, type FloorElements, type MonitorType } from "@/lib/monitor-map";
import { safeJson } from "@/lib/fetch-json";

interface LocationData {
  buildingLabel: string;
  floorLabel: string;
  imageUrl: string;
  elements: FloorElements;
  itemId: string;
  crop: { x: number; y: number; w: number; h: number };
}

type Stage = "loading" | "error" | "confirm" | "choose" | "reportNote" | "reported" | "confirmed";

export default function MonitorQrLanding() {
  const { itemId } = useParams<{ itemId: string }>();
  const router = useRouter();

  const [data, setData] = useState<LocationData | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    fetch(`/api/monitor-location/${encodeURIComponent(itemId)}`)
      .then(r => safeJson(r))
      .then(json => {
        if (!json.ok) { setErrorMsg(json.error ?? "좌석 정보를 찾을 수 없습니다."); setStage("error"); return; }
        setData(json);
        setStage("confirm");
      })
      .catch(() => { setErrorMsg("네트워크 오류입니다."); setStage("error"); });
  }, [itemId]);

  async function confirmNormal() {
    if (!itemId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/monitor-audit-confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const json = await safeJson(res);
      setStage(json.ok ? "confirmed" : "error");
      if (!json.ok) setErrorMsg(json.error ?? "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLocationReport() {
    if (!itemId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/monitor-location-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, note }),
      });
      const json = await safeJson(res);
      setStage(json.ok ? "reported" : "error");
      if (!json.ok) setErrorMsg(json.error ?? "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function goToRepairForm() {
    if (!data) return;
    const params = new URLSearchParams({ itemId: data.itemId, building: data.buildingLabel, floor: data.floorLabel });
    router.push(`/request/repair?${params.toString()}`);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0C0E", color: "#F4F4F5", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 18px 40px" }}>
      <style>{`
        @keyframes qrPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .qr-highlight { animation: qrPulse 1.1s ease-in-out infinite; }
        .qr-btn { font-family: inherit; font-size: 15px; font-weight: 700; border-radius: 12px; padding: 14px 18px; border: none; cursor: pointer; width: 100%; }
      `}</style>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#8B8F99", textTransform: "uppercase", marginBottom: 8 }}>
        모니터 위치 확인
      </div>

      {stage === "loading" && <div style={{ color: "#8B8F99", marginTop: 60 }}>불러오는 중…</div>}
      {stage === "error" && (
        <div style={{ color: "#F87171", marginTop: 60, textAlign: "center", maxWidth: 320 }}>{errorMsg}</div>
      )}

      {data && stage !== "loading" && stage !== "error" && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 18px", textAlign: "center" }}>
            {data.buildingLabel} {data.floorLabel} — 이 자리가 맞나요?
          </h1>

          <div style={{ width: "100%", maxWidth: 420, background: "#17181C", borderRadius: 16, padding: 12, marginBottom: 20 }}>
            <svg viewBox={`${data.crop.x} ${data.crop.y} ${data.crop.w} ${data.crop.h}`}
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 10, background: "#0F1013" }}
              role="img" aria-label={`${data.buildingLabel} ${data.floorLabel} 도면에서 강조 표시된 좌석 위치`}>
              {data.imageUrl && (
                <image href={data.imageUrl} x={0} y={0} width={data.elements.canvasW} height={data.elements.canvasH} preserveAspectRatio="none" opacity={0.9} />
              )}
              {data.elements.zones.map(z => (
                <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h} fill="none" stroke={z.color} strokeOpacity={0.5} strokeDasharray="8,5" rx={5} />
              ))}
              {data.elements.items.map(item => {
                const meta = MONITOR_META[item.monitorType as MonitorType] ?? MONITOR_META.unk;
                const isTarget = item.id === data.itemId;
                return (
                  <g key={item.id}>
                    <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={5}
                      fill={meta.color} opacity={isTarget ? 1 : 0.45} />
                    {isTarget && (
                      <rect className="qr-highlight" x={item.x - 8} y={item.y - 8} width={item.w + 16} height={item.h + 16}
                        rx={9} fill="none" stroke="#FACC15" strokeWidth={4} />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {stage === "confirm" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 420 }}>
              <button className="qr-btn" style={{ background: "#22C55E", color: "#08130B" }} onClick={() => setStage("choose")}>
                네, 맞아요
              </button>
              <button className="qr-btn" style={{ background: "#27282E", color: "#F4F4F5" }} onClick={() => setStage("reportNote")}>
                아니요, 다른 곳이에요
              </button>
            </div>
          )}

          {stage === "choose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 420 }}>
              <button className="qr-btn" disabled={busy} style={{ background: "#22C55E", color: "#08130B", opacity: busy ? 0.6 : 1 }} onClick={confirmNormal}>
                정상이에요 (실사 확인)
              </button>
              <button className="qr-btn" style={{ background: "#F97316", color: "#1A0D02" }} onClick={goToRepairForm}>
                고장났어요
              </button>
            </div>
          )}

          {stage === "reportNote" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 420 }}>
              <p style={{ fontSize: 13, color: "#B4B7C0", margin: "0 0 4px" }}>
                실제 위치를 간단히 알려주시면 확인이 빨라집니다(선택).
              </p>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="예: 3층 창가 쪽으로 옮겼어요"
                rows={3} style={{ width: "100%", borderRadius: 10, border: "1px solid #34363E", background: "#17181C", color: "#F4F4F5", padding: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
              <button className="qr-btn" disabled={busy} style={{ background: "#22C55E", color: "#08130B", opacity: busy ? 0.6 : 1 }} onClick={submitLocationReport}>
                신고하기
              </button>
            </div>
          )}

          {stage === "confirmed" && (
            <div style={{ textAlign: "center", color: "#86EFAC", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
              확인 감사합니다. 실사 기록에 남았습니다.
            </div>
          )}
          {stage === "reported" && (
            <div style={{ textAlign: "center", color: "#86EFAC", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
              신고 감사합니다. 확인 후 배치도에 반영하겠습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
