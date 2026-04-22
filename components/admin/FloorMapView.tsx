"use client";
import { type EditorData } from "./FloorMapEditor";

const MONITOR_META: Record<string, { label: string; color: string }> = {
  std27: { label: '27"', color: "#2563EB" },
  std24: { label: '24"', color: "#0284C7" },
  dev34: { label: '34"', color: "#7C3AED" },
  none:  { label: "✕",  color: "#DC2626" },
  unk:   { label: "·",  color: "#94A3B8" },
};
const FACILITY_META: Record<string, { icon: string; color: string }> = {
  elevator: { icon: "EV",   color: "#1D4ED8" },
  stairs:   { icon: "계단",  color: "#374151" },
  entrance: { icon: "입구",  color: "#15803D" },
  exit:     { icon: "EXIT", color: "#DC2626" },
  restroom: { icon: "WC",   color: "#6B7280" },
};

export default function FloorMapView({ data, className }: { data: EditorData; className?: string }) {
  const hasContent = data.imageUrl || data.items.length > 0 || data.zones.length > 0 || data.facilities.length > 0;
  if (!hasContent) return null;

  // 렌더 순서: renderOrder 기준, 없으면 zones → facilities → items
  type RE = { type: "zone"|"item"|"facility"; d: any };
  const ro = data.renderOrder ?? [];
  const inOrder = new Set(ro);
  const ordered: RE[] = ro.map(id => {
    const z = data.zones.find(z => z.id === id);      if (z) return { type: "zone"     as const, d: z };
    const f = data.facilities.find(f => f.id === id); if (f) return { type: "facility" as const, d: f };
    const i = data.items.find(i => i.id === id);      if (i) return { type: "item"     as const, d: i };
    return null;
  }).filter(Boolean) as RE[];
  const unordered: RE[] = [
    ...data.zones.filter(z => !inOrder.has(z.id)).map(d => ({ type: "zone"     as const, d })),
    ...data.facilities.filter(f => !inOrder.has(f.id)).map(d => ({ type: "facility" as const, d })),
    ...data.items.filter(i => !inOrder.has(i.id)).map(d => ({ type: "item"     as const, d })),
  ];
  const entities: RE[] = [...ordered, ...unordered];

  // 캔버스 크기: 저장된 값 우선, 없으면 항목 바운딩 박스로 추정
  let vw = data.canvasW ?? 1000;
  let vh = data.canvasH ?? 700;
  if (!data.canvasW && (data.items.length || data.zones.length || data.facilities.length)) {
    const xs: number[] = [], ys: number[] = [];
    data.items.forEach(i => { xs.push(i.x, i.x+i.w); ys.push(i.y, i.y+i.h); });
    data.zones.forEach(z => { xs.push(z.x, z.x+z.w); ys.push(z.y, z.y+z.h); });
    data.facilities.forEach(f => { xs.push(f.x+f.r, f.x-f.r); ys.push(f.y+f.r, f.y-f.r); });
    if (xs.length) {
      vw = Math.max(Math.max(...xs) + 40, 400);
      vh = Math.max(Math.max(...ys) + 40, 300);
    }
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        style={{ width: "100%", display: "block", aspectRatio: `${vw}/${vh}` }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm">

        {data.imageUrl && (
          <image href={data.imageUrl} x={0} y={0} width={vw} height={vh}
            preserveAspectRatio="none" style={{ pointerEvents: "none" }}/>
        )}

        {!data.imageUrl && (
          <g opacity={0.06} style={{ pointerEvents: "none" }}>
            {Array.from({ length: Math.ceil(vw/50)+1 }, (_, i) => (
              <line key={`gv${i}`} x1={i*50} y1={0} x2={i*50} y2={vh} stroke="#94A3B8" strokeWidth={0.5}/>
            ))}
            {Array.from({ length: Math.ceil(vh/50)+1 }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={i*50} x2={vw} y2={i*50} stroke="#94A3B8" strokeWidth={0.5}/>
            ))}
          </g>
        )}

        {entities.map(entity => {
          if (entity.type === "zone") {
            const z = entity.d;
            const rot = z.rotation ?? 0;
            const zcx = z.x + z.w/2, zcy = z.y + z.h/2;
            return (
              <g key={z.id} transform={rot ? `rotate(${rot}, ${zcx}, ${zcy})` : undefined}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h}
                  fill={z.color+"22"} stroke={z.color} strokeWidth={1.5} strokeDasharray="10,5" rx={5}
                  style={{ pointerEvents: "none" }}/>
                <text x={z.x+8} y={z.y+18} fontSize={12} fontWeight="700" fill={z.color}
                  style={{ pointerEvents: "none" }}>{z.name}</text>
                {z.tags?.length > 0 && (
                  <text x={z.x+8} y={z.y+32} fontSize={9} fill={z.color} opacity={0.6}
                    style={{ pointerEvents: "none" }}>{z.tags.join(", ")}</text>
                )}
              </g>
            );
          }

          if (entity.type === "facility") {
            const fac = entity.d;
            const meta = FACILITY_META[fac.kind] ?? { icon: "?", color: "#9CA3AF" };
            return (
              <g key={fac.id} style={{ pointerEvents: "none" }}>
                <circle cx={fac.x+1} cy={fac.y+2} r={fac.r} fill="#00000015"/>
                <circle cx={fac.x} cy={fac.y} r={fac.r} fill={meta.color} opacity={0.9}/>
                <text x={fac.x} y={fac.y+4} textAnchor="middle"
                  fontSize={Math.max(7, fac.r * 0.5)} fontWeight="700" fill="white">
                  {meta.icon}
                </text>
                {fac.label && (
                  <text x={fac.x} y={fac.y+fac.r+14} textAnchor="middle" fontSize={10}
                    fill={meta.color} fontWeight="600">{fac.label}</text>
                )}
              </g>
            );
          }

          if (entity.type === "item") {
            const item = entity.d;
            const { x, y, w, h } = item;
            const cx = x+w/2, cy = y+h/2;
            const meta = MONITOR_META[item.monitorType] ?? MONITOR_META.unk;
            return (
              <g key={item.id} style={{ pointerEvents: "none" }}>
                <g transform={`rotate(${item.rotation ?? 0}, ${cx}, ${cy})`}>
                  <rect x={x+2} y={y+2} width={w} height={h} rx={5} fill="#00000015"/>
                  <rect x={x} y={y} width={w} height={h} rx={5} fill={meta.color+"CC"}/>
                  <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={10} fontWeight="700" fill="white">{meta.label}</text>
                  {item.label && item.label !== "Monitor" && (
                    <text x={cx} y={y+h+12} textAnchor="middle" fontSize={9}
                      fill={meta.color} fontWeight="500">{item.label}</text>
                  )}
                </g>
              </g>
            );
          }
          return null;
        })}
      </svg>

      {/* 범례 */}
      {data.items.length > 0 && (
        <div className="flex gap-3 mt-2 px-1 flex-wrap items-center">
          {Object.entries(MONITOR_META).map(([k, v]) => {
            const count = data.items.filter(i => i.monitorType === k).length;
            if (!count) return null;
            return (
              <div key={k} className="flex items-center gap-1">
                <div className="w-3 h-2.5 rounded-sm" style={{ background: v.color+"CC" }}/>
                <span className="text-[11px] text-gray-500">{v.label}</span>
                <span className="text-[10px] text-gray-400">({count})</span>
              </div>
            );
          })}
          <span className="text-[10px] text-gray-300 ml-auto">총 {data.items.length}개 모니터</span>
        </div>
      )}
    </div>
  );
}
