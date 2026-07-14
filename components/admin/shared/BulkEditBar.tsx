"use client";

import { useState } from "react";
import BulkEditModal, { type BulkFieldOption, type BulkApplyResult } from "./BulkEditModal";

export type { BulkFieldOption, BulkApplyResult };

interface BulkEditBarProps {
  count: number;
  fieldOptions: BulkFieldOption[];
  onClear: () => void;
  onApply: (fieldKey: string, value: string) => Promise<BulkApplyResult>;
  extraActions?: React.ReactNode;
}

// 체크박스로 여러 행을 선택했을 때 뜨는 플로팅 액션 바 — HW/라이선스 패널 공용
export default function BulkEditBar({ count, fieldOptions, onClear, onApply, extraActions }: BulkEditBarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{count}건 선택됨</span>
      <button onClick={() => setModalOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
        일괄 수정
      </button>
      {extraActions}
      <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">선택 해제</button>

      {modalOpen && (
        <BulkEditModal
          count={count}
          fieldOptions={fieldOptions}
          onClose={() => setModalOpen(false)}
          onApply={onApply}
        />
      )}
    </div>
  );
}
