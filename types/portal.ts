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

export type ResourceCategory = "install" | "policy" | "forms" | "other";

export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  fileUrl: string;
  fileType: string;      // PDF, XLSX, DOCX …
  fileSize: string;      // 예: "2.1 MB"
  description: string;
  updatedAt: string;     // YYYY-MM-DD
  order: number;
  visible: boolean;
  createdAt: string;
}

export interface SwFile {
  id: string;
  name: string;
  category: string;
  version: string;
  description: string;
  downloadUrl: string;
  fileSize: string;
  os: string[];          // ["Windows", "macOS", "Linux"]
  visible: boolean;
  updatedAt: string;
}

export interface SwVersion {
  id: string;
  name: string;        // SW명
  version: string;     // 버전
  category: string;    // 카테고리
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
}
