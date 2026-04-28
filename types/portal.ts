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
