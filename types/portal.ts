export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;          // YYYY-MM-DD
  urgent: boolean;
  imageUrl?: string;
  visible: boolean;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  deadline: string;      // YYYY-MM-DD
  duration: string;      // 예: "45분"
  courseUrl: string;
  category: "required" | "material" | "policy";
  thumbnailUrl?: string;
  order: number;
  visible: boolean;
  createdAt: string;
}

export interface SwVersion {
  id: string;
  name: string;        // SW명
  version: string;     // 버전
  category: string;    // 카테고리
  tier: "업무용" | "무료프로그램"; // 구분 — 신청 없이 바로 다운로드 가능한 무료 프로그램인지
  os: string[];        // ["Windows", "macOS", "Linux"]
  description: string;
  visible: boolean;
  order: number;
}

export interface SwDoc {
  id: string;
  name: string;        // 파일명
  type: string;        // 설치파일 | 설치안내 | 규정 | 기타
  description: string; // 텍스트
  versionId: string;   // 관련 버전 ID
  visible: boolean;
  order: number;
  fileUrl?: string;    // 첨부 파일 URL (Notion 서명 URL 또는 외부 URL)
  fileName?: string;   // 첨부 파일 원본명
}

export interface DeclarationLog {
  id: string;
  type: "personal" | "team";
  company: string;
  department: string;
  name?: string;        // 개인 실사에서만 사용
  count: number;         // 확인/등록된 SW 건수
  timestamp: string;     // ISO
}

export interface Manual {
  id: string;
  title: string;        // 제목
  slug: string;         // 슬러그 (공개 링크 /manual/{slug})
  category: string;     // 카테고리
  description: string;  // 설명
  visible: boolean;     // 공개 여부
  order: number;        // 순서
  fileUrl?: string;     // 첨부된 HTML 파일의 Notion 서명 URL
  fileName?: string;    // 첨부 파일 원본명
}
