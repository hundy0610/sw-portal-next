"use client";

import { useState, useEffect } from "react";
import type { WorkStage } from "@/types/work-tracker";
import { DEFAULT_WORK_STAGES, UNASSIGNED_WORK_STAGE } from "@/types/work-tracker";
import { safeJson } from "@/lib/fetch-json";

interface WorkTask {
  id:               string;
  title:            string;
  content:          string;
  collaboratorName: string;
  collaboratorId:   string;
  status:           string;
  createdAt:        string;
  parentId:         string;
  shared:           boolean;
}

interface TaskFormState {
  title:             string;
  content:           string;
  collaboratorNames: string[];
  shared:            boolean;
}

// ── 작업 추가 모달 ────────────────────────────────────────
const FIELD_LABEL_STYLE = { fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" as const };
const FIELD_INPUT_STYLE = { width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0f172a", boxSizing: "border-box" as const, background: "#fff" };

function TaskFormModal({ title, form, setForm, collaboratorOptions, onCancel, onSubmit, submitting }: {
  title: string;
  form: TaskFormState;
  setForm: (updater: (f: TaskFormState | null) => TaskFormState | null) => void;
  collaboratorOptions: string[];
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, boxShadow: "0 24px 70px rgba(0,0,0,.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column" as const, gap: 16 }}>
          <div>
            <label style={FIELD_LABEL_STYLE}>제목</label>
            <input value={form.title} onChange={e => setForm(f => f ? { ...f, title: e.target.value } : f)}
              placeholder="작업 제목을 입력하세요" autoFocus
              style={FIELD_INPUT_STYLE} />
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>내용</label>
            <textarea value={form.content} onChange={e => setForm(f => f ? { ...f, content: e.target.value } : f)}
              placeholder="내용 (선택)" rows={5}
              style={{ ...FIELD_INPUT_STYLE, resize: "vertical" as const, fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>협업자 (복수 선택 가능)</label>
            <div style={{ ...FIELD_INPUT_STYLE, display: "flex", flexWrap: "wrap" as const, gap: 6, cursor: "default" }}>
              {Array.from(new Set([...collaboratorOptions, ...form.collaboratorNames])).map(name => {
                const active = form.collaboratorNames.includes(name);
                return (
                  <button key={name} type="button"
                    onClick={() => setForm(f => f ? {
                      ...f,
                      collaboratorNames: active ? f.collaboratorNames.filter(n => n !== name) : [...f.collaboratorNames, name],
                    } : f)}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${active ? "#2563EB" : "#E2E8F0"}`,
                      background: active ? "#EFF6FF" : "#fff",
                      color: active ? "#2563EB" : "#64748b",
                    }}>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>공유</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {form.shared ? "전체 보기(공유됨)에 표시됩니다" : "나에게만 표시됩니다"}
              </div>
            </div>
            <button type="button" onClick={() => setForm(f => f ? { ...f, shared: !f.shared } : f)}
              style={{ width: 40, height: 22, borderRadius: 20, border: "none", position: "relative" as const, background: form.shared ? "#2563EB" : "#CBD5E1", cursor: "pointer", padding: 0, flexShrink: 0, transition: "background .15s" }}>
              <span style={{ position: "absolute" as const, top: 2, left: form.shared ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 8, justifyContent: "flex-end", background: "#FAFBFC" }}>
          <button onClick={onCancel}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            취소
          </button>
          <button onClick={onSubmit} disabled={!form.title.trim() || submitting}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: !form.title.trim() || submitting ? "#E2E8F0" : "#2563EB", color: !form.title.trim() || submitting ? "#94a3b8" : "#fff", fontSize: 12, fontWeight: 700, cursor: !form.title.trim() || submitting ? "not-allowed" : "pointer" }}>
            {submitting ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 작업 카드 ─────────────────────────────────────────────
function TaskCard({ t, dragging, parentTitle, childTotal, childDone, showCollaborator, onClick, onDragStart, onDragEnd }: {
  t: WorkTask;
  dragging: boolean;
  parentTitle?: string;
  childTotal: number;
  childDone: number;
  showCollaborator: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: dragging ? "#F0F4FF" : "#fff",
        opacity: dragging ? 0.6 : 1,
        border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 12px",
        marginBottom: 8, cursor: "grab",
      }}
    >
      {parentTitle && (
        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          ↳ {parentTitle}
        </div>
      )}
      <div style={{
        fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 6, lineHeight: 1.4,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
      }}>
        {t.title || "(제목 없음)"}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 6 }}>
        {t.shared && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#E0F2FE", color: "#0369A1" }}>공유됨</span>
        )}
        {childTotal > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: childDone === childTotal ? "#DCFCE7" : "#EFF6FF", color: childDone === childTotal ? "#15803D" : "#2563EB" }}>
            하위 {childDone}/{childTotal}
          </span>
        )}
      </div>
      {showCollaborator && (
        <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{t.collaboratorName}</div>
      )}
    </div>
  );
}

// ── 칸반 컬럼 ─────────────────────────────────────────────
function KanbanColumn({ stage, tasks, allTasks, lastStageName, isDragTarget, dragId, showCollaborator, onDragOver, onDragLeave, onDrop, onDeleteStage, onAddClick, addLabel, onCardClick, onCardDragStart, onCardDragEnd }: {
  stage: WorkStage;
  tasks: WorkTask[];
  allTasks: WorkTask[];
  lastStageName: string;
  isDragTarget: boolean;
  dragId: string | null;
  showCollaborator: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDeleteStage?: () => void;
  onAddClick?: () => void;
  addLabel?: string;
  onCardClick: (t: WorkTask) => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
}) {
  return (
    <div
      style={{
        flex: "0 0 240px", minWidth: 240, marginRight: 10, minHeight: 360,
        display: "flex", flexDirection: "column" as const, borderRadius: 12,
        background: isDragTarget ? stage.color : "#F8FAFC",
        border: `2px solid ${isDragTarget ? stage.border : "#E2E8F0"}`,
        transition: "all .15s",
      }}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
    >
      <div style={{
        padding: "10px 12px", borderRadius: "10px 10px 0 0", background: stage.color,
        borderBottom: `2px solid ${stage.border}30`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: stage.tc, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{stage.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: stage.border + "20", color: stage.tc, flexShrink: 0 }}>{tasks.length}</span>
        </div>
        {onDeleteStage && (
          <button onClick={onDeleteStage} title="단계 삭제"
            style={{ background: "none", border: "none", cursor: "pointer", color: stage.tc, opacity: .5, fontSize: 13, lineHeight: 1, padding: 2, flexShrink: 0 }}>
            ✕
          </button>
        )}
      </div>
      <div style={{ flex: 1, padding: 10, overflowY: "auto" as const }}>
        {onAddClick && (
          <div onClick={onAddClick}
            style={{
              border: "1px dashed #CBD5E1", borderRadius: 8, padding: "6px 10px",
              marginBottom: 8, textAlign: "center" as const, fontSize: 12,
              color: "#94a3b8", cursor: "pointer", background: "#FAFBFC", fontWeight: 600,
            }}>
            {addLabel ?? "+ 추가"}
          </div>
        )}
        {tasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", fontSize: 11, color: "#cbd5e1" }}>
            {isDragTarget ? "여기에 놓기" : "없음"}
          </div>
        ) : tasks.map(t => {
          const children = allTasks.filter(c => c.parentId === t.id);
          const parent = t.parentId ? allTasks.find(p => p.id === t.parentId) : undefined;
          return (
            <TaskCard key={t.id} t={t} dragging={dragId === t.id}
              parentTitle={parent?.title}
              childTotal={children.length}
              childDone={children.filter(c => c.status === lastStageName).length}
              showCollaborator={showCollaborator}
              onClick={() => onCardClick(t)}
              onDragStart={() => onCardDragStart(t.id)}
              onDragEnd={onCardDragEnd} />
          );
        })}
      </div>
    </div>
  );
}

const ALL_TAB = "__all__";
const MY_TAB  = "__mine__";

export default function WorkTrackerPanel({ session }: { session: { userId: string; name: string } }) {
  const [tasks, setTasks]     = useState<WorkTask[]>([]);
  const [stages, setStages]   = useState<WorkStage[]>(DEFAULT_WORK_STAGES);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>(MY_TAB);

  const [selected, setSelected] = useState<WorkTask | null>(null);
  const [editing, setEditing]   = useState(false);
  const [editTitle, setEditTitle]     = useState("");
  const [editContent, setEditContent] = useState("");

  const [editingCollaborators, setEditingCollaborators] = useState(false);
  const [editCollaboratorNames, setEditCollaboratorNames] = useState<string[]>([]);

  const [dragId, setDragId]     = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [newTaskForm, setNewTaskForm] = useState<TaskFormState | null>(null);
  const [creating, setCreating] = useState(false);

  const [subTaskForm, setSubTaskForm] = useState<TaskFormState | null>(null);
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  const [modalDragId, setModalDragId]     = useState<string | null>(null);
  const [modalDragOver, setModalDragOver] = useState<string | null>(null);

  const [collaboratorOptions, setCollaboratorOptions] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, stagesRes] = await Promise.all([
        fetch("/api/work-tracker"),
        fetch("/api/work-tracker/stages"),
      ]);
      if (!tasksRes.ok) { setError(`오류 ${tasksRes.status}: ${await tasksRes.text()}`); return; }
      const { data } = await safeJson(tasksRes);
      setTasks(data ?? []);
      if (stagesRes.ok) {
        const { data: stageData } = await safeJson(stagesRes);
        if (Array.isArray(stageData) && stageData.length > 0) setStages(stageData);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadAccounts() {
    try {
      const res = await fetch("/api/admin/accounts");
      if (!res.ok) return;
      const { accounts } = await safeJson(res);
      if (Array.isArray(accounts)) {
        const names: string[] = accounts
          .filter((a: { active: boolean; role: string; name: string }) => a.active && a.role === "super" && a.name !== session.name)
          .map((a: { name: string }) => a.name);
        setCollaboratorOptions(names);
      }
    } catch {}
  }

  async function backgroundLoad() {
    try {
      const res = await fetch("/api/work-tracker");
      if (!res.ok) return;
      const { data } = await safeJson(res);
      setTasks(data ?? []);
    } catch {}
  }

  useEffect(() => { load(); loadAccounts(); }, []);

  function openDetail(t: WorkTask) {
    setSelected(t);
    setEditing(false);
    setEditTitle(t.title);
    setEditContent(t.content);
    setEditingCollaborators(false);
    setEditCollaboratorNames(t.collaboratorName ? t.collaboratorName.split(",").map(s => s.trim()).filter(Boolean) : []);
    setSubTaskForm(null);
    setModalDragId(null);
    setModalDragOver(null);
  }

  function childrenOf(id: string) {
    return tasks.filter(t => t.parentId === id);
  }

  function closeDetail() {
    setSelected(null);
    setSubTaskForm(null);
  }

  async function handleCreateTask() {
    if (!newTaskForm || !newTaskForm.title.trim() || creating || activeTab !== MY_TAB) return;
    setCreating(true);
    try {
      await fetch("/api/work-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskForm.title.trim(),
          content: newTaskForm.content.trim(),
          collaboratorId: session.userId,
          collaboratorName: newTaskForm.collaboratorNames.join(", ") || session.name,
          status: stages[0]?.name ?? "할 일",
          parentId: "",
          shared: newTaskForm.shared,
        }),
      });
      setNewTaskForm(null);
      backgroundLoad();
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateSubtask() {
    if (!selected || !subTaskForm || !subTaskForm.title.trim() || creatingSubtask) return;
    setCreatingSubtask(true);
    try {
      await fetch("/api/work-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subTaskForm.title.trim(),
          content: subTaskForm.content.trim(),
          collaboratorId: selected.collaboratorId,
          collaboratorName: subTaskForm.collaboratorNames.join(", ") || selected.collaboratorName,
          status: stages[0]?.name ?? "할 일",
          parentId: selected.id,
          shared: subTaskForm.shared,
        }),
      });
      setSubTaskForm(null);
      backgroundLoad();
    } finally {
      setCreatingSubtask(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    setSelected(prev => prev && prev.id === id ? { ...prev, status } : prev);
    await fetch("/api/work-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "status", id, status }),
    });
    backgroundLoad();
  }

  async function handleToggleShared(t: WorkTask) {
    const shared = !t.shared;
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, shared } : x));
    setSelected(prev => prev && prev.id === t.id ? { ...prev, shared } : prev);
    await fetch("/api/work-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "shared", id: t.id, shared }),
    });
    backgroundLoad();
  }

  async function handleSaveContent() {
    if (!selected) return;
    const title = editTitle.trim();
    const content = editContent.trim();
    setTasks(prev => prev.map(t => t.id === selected.id ? { ...t, title, content } : t));
    setSelected(prev => prev ? { ...prev, title, content } : prev);
    setEditing(false);
    await fetch("/api/work-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "content", id: selected.id, title, content }),
    });
    backgroundLoad();
  }

  async function handleSaveCollaborators() {
    if (!selected) return;
    const collaboratorName = editCollaboratorNames.join(", ");
    setTasks(prev => prev.map(t => t.id === selected.id ? { ...t, collaboratorName } : t));
    setSelected(prev => prev ? { ...prev, collaboratorName } : prev);
    setEditingCollaborators(false);
    await fetch("/api/work-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "collaborators", id: selected.id, collaboratorName }),
    });
    backgroundLoad();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 작업을 삭제할까요?")) return;
    await fetch("/api/work-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id }),
    });
    closeDetail();
    load();
  }

  async function saveStages(next: WorkStage[]) {
    setStages(next);
    await fetch("/api/work-tracker/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: next }),
    });
  }

  function deleteStage(name: string) {
    const count = tasks.filter(t => t.status === name).length;
    if (count > 0) { alert(`"${name}" 단계에 작업이 ${count}건 있어 삭제할 수 없습니다.`); return; }
    if (!confirm(`"${name}" 단계를 삭제할까요?`)) return;
    saveStages(stages.filter(s => s.name !== name));
  }

  const isAllTab = activeTab === ALL_TAB;

  const filtered = tasks.filter(t =>
    !t.parentId && (isAllTab ? t.shared : t.collaboratorId === session.userId)
  );

  const unassigned = filtered.filter(t => !stages.some(s => s.name === t.status));
  const lastStageName = stages[stages.length - 1]?.name ?? "";

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>작업 트래커</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>총 {filtered.length}건</p>
        </div>
        <button onClick={load}
          style={{ padding: "8px 14px", borderRadius: 8, background: "#EFF6FF", color: "#2563EB", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          새로고침
        </button>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" as const, borderBottom: "1px solid #E2E8F0", paddingBottom: 10 }}>
        <button onClick={() => setActiveTab(MY_TAB)}
          style={{
            padding: "6px 14px", borderRadius: 20, border: "none",
            background: !isAllTab ? "#0f172a" : "#F1F5F9",
            color: !isAllTab ? "#fff" : "#334155",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
          내 작업
        </button>
        <button onClick={() => setActiveTab(ALL_TAB)}
          style={{
            padding: "6px 14px", borderRadius: 20, border: "none",
            background: isAllTab ? "#0f172a" : "#F1F5F9",
            color: isAllTab ? "#fff" : "#334155",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
          전체 보기 (공유됨)
        </button>
      </div>

      {/* 칸반 보드 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, color: "#DC2626", fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>⚠️ 데이터를 불러오지 못했습니다</div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{error}</div>
        </div>
      ) : (
        <div style={{ display: "flex", overflowX: "auto" as const, paddingBottom: 12 }}>
          {stages.map((stage, i) => (
            <KanbanColumn
              key={stage.name}
              stage={stage}
              tasks={filtered.filter(t => t.status === stage.name)}
              allTasks={tasks}
              lastStageName={lastStageName}
              isDragTarget={dragOver === stage.name}
              dragId={dragId}
              showCollaborator={isAllTab}
              onDragOver={() => setDragOver(stage.name)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                setDragOver(null);
                const dragged = tasks.find(t => t.id === dragId);
                if (dragId && dragged && dragged.status !== stage.name) {
                  handleStatusChange(dragId, stage.name);
                }
                setDragId(null);
              }}
              onDeleteStage={() => deleteStage(stage.name)}
              onAddClick={!isAllTab && i === 0 ? () => setNewTaskForm({ title: "", content: "", collaboratorNames: [], shared: false }) : undefined}
              addLabel="+ 새 작업 추가"
              onCardClick={openDetail}
              onCardDragStart={setDragId}
              onCardDragEnd={() => { setDragId(null); setDragOver(null); }}
            />
          ))}
          {unassigned.length > 0 && (
            <KanbanColumn
              stage={UNASSIGNED_WORK_STAGE}
              tasks={unassigned}
              allTasks={tasks}
              lastStageName={lastStageName}
              isDragTarget={false}
              dragId={dragId}
              showCollaborator={isAllTab}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onDrop={() => {}}
              onCardClick={openDetail}
              onCardDragStart={setDragId}
              onCardDragEnd={() => { setDragId(null); setDragOver(null); }}
            />
          )}
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {selected && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 1200, height: "min(90vh, 820px)", boxShadow: "0 20px 60px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>

            {/* ── 고정 헤더 ── */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  {editing ? (
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                      style={{ width: "100%", fontSize: 15, fontWeight: 700, color: "#0f172a", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px", boxSizing: "border-box" as const }} />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{selected.title}</div>
                  )}
                </div>
                <button onClick={closeDetail} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>

              {/* 단계 버튼 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
                {stages.map(s => {
                  const active = selected.status === s.name;
                  return (
                    <button key={s.name} onClick={() => handleStatusChange(selected.id, s.name)}
                      style={{ padding: "4px 13px", borderRadius: 20, border: `2px solid ${active ? s.tc : "#E2E8F0"}`, background: active ? s.color : "#fff", color: active ? s.tc : "#64748b", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                      {s.name}
                    </button>
                  );
                })}
              </div>

              {/* 공유 토글 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>공유:</span>
                <button onClick={() => handleToggleShared(selected)}
                  style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20,
                    border: `1px solid ${selected.shared ? "#BAE6FD" : "#E2E8F0"}`,
                    background: selected.shared ? "#E0F2FE" : "#fff",
                    color: selected.shared ? "#0369A1" : "#94a3b8",
                    cursor: "pointer", fontWeight: 600,
                  }}>
                  {selected.shared ? "공유됨 (전체 보기에 표시)" : "비공개"}
                </button>
              </div>

              {/* 협업자 */}
              <div style={{ marginTop: 8 }}>
                {editingCollaborators ? (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 6 }}>
                      {Array.from(new Set([...collaboratorOptions, ...editCollaboratorNames])).map(name => {
                        const active = editCollaboratorNames.includes(name);
                        return (
                          <button key={name} type="button"
                            onClick={() => setEditCollaboratorNames(prev => active ? prev.filter(n => n !== name) : [...prev, name])}
                            style={{
                              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: `1px solid ${active ? "#2563EB" : "#E2E8F0"}`,
                              background: active ? "#EFF6FF" : "#fff",
                              color: active ? "#2563EB" : "#64748b",
                            }}>
                            {name}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={handleSaveCollaborators}
                        style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        저장
                      </button>
                      <button onClick={() => { setEditingCollaborators(false); setEditCollaboratorNames(selected.collaboratorName ? selected.collaboratorName.split(",").map(s => s.trim()).filter(Boolean) : []); }}
                        style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                    {selected.collaboratorName.split(",").map(s => s.trim()).filter(Boolean).map(name => (
                      <span key={name} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{name}</span>
                    ))}
                    <button onClick={() => setEditingCollaborators(true)}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>
                      협업자 수정
                    </button>
                  </div>
                )}
              </div>

              {/* 상위 작업 */}
              {selected.parentId && (() => {
                const parent = tasks.find(t => t.id === selected.parentId);
                return parent ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    상위 작업:{" "}
                    <button onClick={() => openDetail(parent)}
                      style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: 12 }}>
                      {parent.title}
                    </button>
                  </div>
                ) : null;
              })()}
            </div>

            {/* ── 내용 ── */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              {editing ? (
                <>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                    rows={4} placeholder="내용"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0f172a", resize: "vertical" as const, boxSizing: "border-box" as const, fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={handleSaveContent}
                      style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      저장
                    </button>
                    <button onClick={() => { setEditing(false); setEditTitle(selected.title); setEditContent(selected.content); }}
                      style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const, minHeight: 20 }}>{selected.content || "(내용 없음)"}</p>
                  <button onClick={() => setEditing(true)}
                    style={{ marginTop: 8, fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>
                    수정
                  </button>
                </>
              )}
            </div>

            {/* ── 하위 작업 ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px 0", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>하위 작업 ({childrenOf(selected.id).length})</span>
              </div>

              {/* 하위 작업 칸반 */}
              <div style={{ flex: 1, overflow: "auto" as const, display: "flex", alignItems: "flex-start", padding: 16 }}>
                {stages.map((stage, i) => {
                  const subTasks = childrenOf(selected.id);
                  return (
                    <KanbanColumn
                      key={stage.name}
                      stage={stage}
                      tasks={subTasks.filter(c => c.status === stage.name)}
                      allTasks={tasks}
                      lastStageName={lastStageName}
                      isDragTarget={modalDragOver === stage.name}
                      dragId={modalDragId}
                      showCollaborator={false}
                      onDragOver={() => setModalDragOver(stage.name)}
                      onDragLeave={() => setModalDragOver(null)}
                      onDrop={() => {
                        setModalDragOver(null);
                        const dragged = subTasks.find(c => c.id === modalDragId);
                        if (modalDragId && dragged && dragged.status !== stage.name) {
                          handleStatusChange(modalDragId, stage.name);
                        }
                        setModalDragId(null);
                      }}
                      onAddClick={i === 0 ? () => setSubTaskForm({ title: "", content: "", collaboratorNames: selected.collaboratorName ? selected.collaboratorName.split(",").map(s => s.trim()).filter(Boolean).filter(n => n !== session.name) : [], shared: false }) : undefined}
                      addLabel="+ 하위 작업 추가"
                      onCardClick={openDetail}
                      onCardDragStart={setModalDragId}
                      onCardDragEnd={() => { setModalDragId(null); setModalDragOver(null); }}
                    />
                  );
                })}
                {(() => {
                  const subUnassigned = childrenOf(selected.id).filter(c => !stages.some(s => s.name === c.status));
                  return subUnassigned.length > 0 ? (
                    <KanbanColumn
                      stage={UNASSIGNED_WORK_STAGE}
                      tasks={subUnassigned}
                      allTasks={tasks}
                      lastStageName={lastStageName}
                      isDragTarget={false}
                      dragId={modalDragId}
                      showCollaborator={false}
                      onDragOver={() => {}}
                      onDragLeave={() => {}}
                      onDrop={() => {}}
                      onCardClick={openDetail}
                      onCardDragStart={setModalDragId}
                      onCardDragEnd={() => { setModalDragId(null); setModalDragOver(null); }}
                    />
                  ) : null;
                })()}
              </div>
            </div>

            {/* ── 하단 버튼 ── */}
            <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", flexShrink: 0, background: "#fff" }}>
              <button onClick={() => handleDelete(selected.id)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #FEE2E2", background: "#FFF5F5", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                삭제
              </button>
              <button onClick={closeDetail}
                style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 새 작업 추가 모달 ── */}
      {newTaskForm && (
        <TaskFormModal
          title="새 작업 추가"
          form={newTaskForm}
          setForm={setNewTaskForm}
          collaboratorOptions={collaboratorOptions}
          onCancel={() => setNewTaskForm(null)}
          onSubmit={handleCreateTask}
          submitting={creating}
        />
      )}

      {/* ── 하위 작업 추가 모달 ── */}
      {subTaskForm && (
        <TaskFormModal
          title="하위 작업 추가"
          form={subTaskForm}
          setForm={setSubTaskForm}
          collaboratorOptions={collaboratorOptions}
          onCancel={() => setSubTaskForm(null)}
          onSubmit={handleCreateSubtask}
          submitting={creatingSubtask}
        />
      )}
    </div>
  );
}
