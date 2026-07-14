"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { OrgUnit, OrgLevel } from "@/lib/org-chart";

const LEVELS: OrgLevel[] = ["사업부", "본부", "센터", "팀"];

type FormState = {
  name: string;
  company: string;
  level: OrgLevel;
  parentId: string;
  managerEmail: string;
  managerName: string;
  deptMapping: string;
};

const EMPTY_FORM: FormState = { name: "", company: "", level: "팀", parentId: "", managerEmail: "", managerName: "", deptMapping: "" };

function unitToForm(u: OrgUnit): FormState {
  return {
    name: u.name, company: u.company, level: u.level, parentId: u.parentId ?? "",
    managerEmail: u.managerEmail, managerName: u.managerName, deptMapping: u.deptMapping.join(", "),
  };
}

// unitId의 모든 하위 조직 id (자기 자신 포함) — 상위조직 선택 시 순환 참조 방지용
function descendantIds(units: OrgUnit[], unitId: string): Set<string> {
  const ids = new Set([unitId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const u of units) {
      if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) { ids.add(u.id); changed = true; }
    }
  }
  return ids;
}

export default function OrgChartPanel() {
  const [units, setUnits]     = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/org-chart");
      const json = await safeJson(res);
      if (json?.ok) setUnits(json.data ?? []);
      else setError(json?.error ?? "조회 실패");
    } catch {
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, OrgUnit[]>();
    for (const u of units) {
      const key = u.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    return map;
  }, [units]);

  const roots = childrenOf.get(null) ?? [];

  function openCreate(parentId: string | null) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, parentId: parentId ?? "" });
    setSaveError("");
    setModalOpen(true);
  }

  function openEdit(unit: OrgUnit) {
    setEditingId(unit.id);
    setForm(unitToForm(unit));
    setSaveError("");
    setModalOpen(true);
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError("이름을 입력하세요."); return; }
    setSaving(true);
    setSaveError("");
    try {
      const data = {
        name: form.name.trim(),
        company: form.company.trim(),
        level: form.level,
        parentId: form.parentId || null,
        managerEmail: form.managerEmail.trim(),
        managerName: form.managerName.trim(),
        deptMapping: form.deptMapping.split(",").map(s => s.trim()).filter(Boolean),
      };
      const body = editingId ? { _action: "update", id: editingId, data } : data;
      const res = await fetch("/api/org-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await safeJson(res);
      if (!json?.ok) { setSaveError(json?.error ?? "저장 실패"); return; }
      setModalOpen(false);
      await load();
    } catch {
      setSaveError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/org-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "delete", id }),
      });
      const json = await safeJson(res);
      if (json?.ok) await load();
      else setError(json?.error ?? "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const excludedParentIds = editingId ? descendantIds(units, editingId) : new Set<string>();

  function renderRow(unit: OrgUnit, depth: number) {
    const kids = childrenOf.get(unit.id) ?? [];
    const expanded = expandedIds.has(unit.id);
    return (
      <div key={unit.id}>
        <div
          className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 border-b border-gray-50"
          style={{ paddingLeft: 8 + depth * 20 }}
        >
          <button
            onClick={() => toggleExpand(unit.id)}
            className="w-4 text-gray-400 text-xs shrink-0"
            disabled={kids.length === 0}
          >
            {kids.length > 0 ? (expanded ? "▼" : "▶") : ""}
          </button>
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-600 shrink-0">{unit.level}</span>
          <span className="text-sm font-medium text-gray-900 truncate">{unit.name}</span>
          {unit.company && <span className="text-xs text-gray-400 shrink-0">· {unit.company}</span>}
          {unit.managerName && <span className="text-xs text-gray-500 shrink-0">담당: {unit.managerName}{unit.managerEmail ? ` (${unit.managerEmail})` : ""}</span>}
          {unit.deptMapping.length > 0 && (
            <span className="text-[11px] text-gray-400 shrink-0">부서 {unit.deptMapping.length}개 매핑</span>
          )}
          <div className="flex-1" />
          <button onClick={() => openCreate(unit.id)} className="text-xs text-blue-600 hover:underline shrink-0">+ 하위추가</button>
          <button onClick={() => openEdit(unit)} className="text-xs text-gray-500 hover:underline shrink-0">수정</button>
          <button
            onClick={() => handleDelete(unit.id)}
            disabled={deletingId === unit.id}
            className="text-xs text-red-500 hover:underline shrink-0 disabled:opacity-40"
          >
            {deletingId === unit.id ? "삭제 중…" : "삭제"}
          </button>
        </div>
        {expanded && kids.map(k => renderRow(k, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">조직도 관리</h2>
          <p className="text-xs text-gray-400 mt-0.5">사업부/본부/센터/팀 계층과 직책자, 실사 진행률 집계용 부서 매핑을 관리합니다.</p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          + 최상위 조직 추가
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="border border-gray-200 rounded-xl bg-white p-2">
        {loading ? (
          <p className="text-xs text-gray-400 px-2 py-4">불러오는 중…</p>
        ) : roots.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-4">등록된 조직이 없습니다. &quot;+ 최상위 조직 추가&quot;로 시작하세요.</p>
        ) : (
          roots.map(u => renderRow(u, 0))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900">{editingId ? "조직 정보 수정" : "조직 추가"}</h3>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">이름 *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
                placeholder="예: 개발본부"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">법인</label>
                <input
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">레벨</label>
                <select
                  value={form.level}
                  onChange={e => setForm(f => ({ ...f, level: e.target.value as OrgLevel }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
                >
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">상위조직</label>
              <select
                value={form.parentId}
                onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">(최상위)</option>
                {units.filter(u => !excludedParentIds.has(u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.level})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">직책자 이메일</label>
                <input
                  type="email"
                  value={form.managerEmail}
                  onChange={e => setForm(f => ({ ...f, managerEmail: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">직책자 이름</label>
                <input
                  value={form.managerName}
                  onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">매핑 부서명 (콤마로 구분)</label>
              <textarea
                value={form.deptMapping}
                onChange={e => setForm(f => ({ ...f, deptMapping: e.target.value }))}
                rows={2}
                placeholder="예: 개발1팀, 개발2팀"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
              <p className="text-[10px] text-gray-400 mt-1">하드웨어 자산관리의 &quot;부서&quot; 값과 일치해야 실사 진행률에 반영됩니다.</p>
            </div>

            {saveError && <p className="text-xs text-red-600">{saveError}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg">취소</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
