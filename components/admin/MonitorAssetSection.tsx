"use client";
import { useState, useEffect, useCallback } from "react";
import type { MonitorAsset } from "@/lib/notion";
import { safeJson } from "@/lib/fetch-json";

const STATUS_OPTIONS = ["사용중", "수리중", "예비", "미설치", "폐기"];

export type AssetForm = {
  assetNo: string;
  model: string;
  status: string;
  corp: string;
  purchaseDate: string;
  note: string;
};

const EMPTY_FORM: AssetForm = { assetNo: "", model: "", status: "사용중", corp: "", purchaseDate: "", note: "" };

// 자산 정보 조회 + 단일/복수 필드 저장(없으면 신규 생성) 훅
export function useMonitorAsset({
  itemId, building, floor, defaultTitle,
}: {
  itemId: string;
  building: string;
  floor: string;
  defaultTitle: string;
}) {
  const [asset,   setAsset]   = useState<MonitorAsset | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/monitor-assets?itemId=${encodeURIComponent(itemId)}`)
      .then(r => safeJson(r))
      .then(({ assets }) => setAsset(assets?.[0] ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => { reload(); }, [reload]);

  const saveFields = useCallback(async (fields: Partial<AssetForm>) => {
    if (asset) {
      setAsset(prev => prev ? { ...prev, ...fields } : prev);
      await fetch(`/api/monitor-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
    } else {
      const res = await fetch(`/api/monitor-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, title: defaultTitle, building, floor, ...fields }),
      });
      const { id } = await safeJson(res);
      setAsset({ id, itemId, title: defaultTitle, building, floor, ...EMPTY_FORM, ...fields });
    }
  }, [asset, itemId, building, floor, defaultTitle]);

  return { asset, loading, saveFields, reload };
}

// 패널 헤더에 표시되는 자산번호 배지 (클릭하여 인라인 편집)
export function AssetNoBadge({
  asset, loading, saveFields,
}: {
  asset: MonitorAsset | null;
  loading: boolean;
  saveFields: (fields: Partial<AssetForm>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { setValue(asset?.assetNo ?? ""); }, [asset?.assetNo]);

  if (loading) return null;

  if (editing) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="자산번호 입력"
          className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50 w-32"
        />
        <button
          disabled={saving}
          onClick={async () => { setSaving(true); try { await saveFields({ assetNo: value }); setEditing(false); } finally { setSaving(false); } }}
          className="text-[10px] text-blue-300 hover:text-blue-100 disabled:opacity-50">
          {saving ? "…" : "저장"}
        </button>
        <button onClick={() => { setValue(asset?.assetNo ?? ""); setEditing(false); }} className="text-[10px] text-white/50 hover:text-white/80">취소</button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 mt-1 group">
      <span className="text-[11px] font-mono font-semibold text-blue-300">{asset?.assetNo || "자산번호 미등록"}</span>
      <span className="text-[9px] opacity-0 group-hover:opacity-60 transition-opacity">✏️</span>
    </button>
  );
}

export default function MonitorAssetSection({
  asset, loading, saveFields,
}: {
  asset: MonitorAsset | null;
  loading: boolean;
  saveFields: (fields: Partial<AssetForm>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState<AssetForm>(EMPTY_FORM);

  useEffect(() => {
    setForm(asset
      ? { assetNo: asset.assetNo, model: asset.model, status: asset.status || "사용중", corp: asset.corp, purchaseDate: asset.purchaseDate, note: asset.note }
      : EMPTY_FORM);
  }, [asset]);

  const save = async () => {
    setSaving(true);
    try {
      await saveFields(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">자산 정보</div>
        {!loading && (
          editing ? (
            <div className="flex gap-1">
              <button onClick={() => { setEditing(false); setForm(asset
                ? { assetNo: asset.assetNo, model: asset.model, status: asset.status || "사용중", corp: asset.corp, purchaseDate: asset.purchaseDate, note: asset.note }
                : EMPTY_FORM); }} className="text-[10px] text-gray-400 hover:text-gray-600">취소</button>
              <button onClick={save} disabled={saving} className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-50">
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-[10px] text-blue-400 hover:text-blue-600">편집</button>
          )
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-gray-400 text-center py-3">불러오는 중…</div>
      ) : editing ? (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-gray-400 mb-1">자산번호</div>
            <input value={form.assetNo} onChange={e => setForm(f => ({ ...f, assetNo: e.target.value }))}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-1">모델/사양</div>
            <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              placeholder="예: 27인치"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-1">상태</div>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-1">법인</div>
            <input value={form.corp} onChange={e => setForm(f => ({ ...f, corp: e.target.value }))}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-1">구매일</div>
            <input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-1">비고</div>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      ) : !asset ? (
        <div className="text-[11px] text-gray-400 text-center py-3">등록된 자산 정보 없음</div>
      ) : (
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between"><span className="text-gray-400">자산번호</span><span className="font-semibold">{asset.assetNo || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">모델/사양</span><span className="font-semibold">{asset.model || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">상태</span><span className="font-semibold">{asset.status || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">법인</span><span className="font-semibold">{asset.corp || "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">구매일</span><span className="font-semibold">{asset.purchaseDate || "—"}</span></div>
          {asset.note && <div className="pt-1 text-gray-500">{asset.note}</div>}
        </div>
      )}
    </div>
  );
}
