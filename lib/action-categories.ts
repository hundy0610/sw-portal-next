// 문의 처리 조치분류 체계 (대분류 > 소분류)
// components/admin/HelpDeskPanel.tsx의 ActionCategoryTree, lib/helpdesk-action-classifier.ts에서 공유 사용
export const ACTION_TREE: { label: string; children: string[] }[] = [
  { label: "하드웨어", children: ["단순 점검", "청소 및 정비", "부품 교체", "외부업체 수리", "자산 교체(노후화)", "자산 교체(고장 및 파손)", "기타"] },
  { label: "소프트웨어", children: ["OS 점검", "OS 재설치", "드라이버 업데이트", "악성코드 점검", "충돌 보안프로그램 점검", "라이선스 재고 지급", "라이선스 신규구매 안내", "라이선스 갱신 안내", "라이선스 설치", "라이선스 계정 관리", "기타"] },
  { label: "기타", children: ["단순 안내", "자산 반납", "자산 이관", "타부서 이관", "해결 불가"] },
];

export const ALL_TREE_KEYS = ACTION_TREE.flatMap(g => g.children.map(c => `${g.label} > ${c}`));
