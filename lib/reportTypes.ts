// ─── SW 카테고리 분류 ──────────────────────────────────────────────────────
const CATEGORY_RULES: [RegExp, string][] = [
  [/(ai|gpt|chatgpt|claude|copilot|gemini|midjourney|dall.?e|stable.?diffusion|perplexity|bard|llm|wrtn|뤼튼|character\.ai|jasper|notion\s*ai)/, "AI"],
  [/(개발|github|gitlab|bitbucket|jira|vs.?code|visual.?studio|intellij|pycharm|datagrip|webstorm|cursor|postman|insomnia|aws|azure|gcp|terraform|docker|jenkins|sentry|linear|vercel|netlify|heroku|kibana|datadog|grafana|sonarqube|sourcetree|xcode|android.?studio|unity|unreal)/, "개발"],
  [/(디자인|figma|sketch|adobe|photoshop|illustrator|indesign|premiere|after.?effects|xd|zeplin|canva|affinity|invision|framer|rive|principle|blender|cinema.?4d)/, "디자인"],
  [/(문서작성|word|excel|powerpoint|한글|hwp|hancom|libreoffice|google.?docs|google.?sheets|google.?slides|onenote|pages|numbers|keynote|microsoft.?365|m365|gsuite|google.?workspace|evernote|bear)/, "문서작성"],
  [/(협업|slack|zoom|teams|webex|google.?meet|notion|asana|monday|trello|miro|dropbox|box\.net|google.?drive|loom|gather|discord|typeform|calendly|confluence|basecamp|airtable|coda)/, "협업"],
];

export function mapCategory(swCategory: string, swDetail: string): string {
  const text = `${swCategory} ${swDetail}`.toLowerCase();
  for (const [pattern, cat] of CATEGORY_RULES) {
    if (pattern.test(text)) return cat;
  }
  return "기타";
}

// ─── 공개 타입 ────────────────────────────────────────────────────────────
export interface SubRow {
  id: string;
  company: string;
  department: string;
  swName: string;
  category: string;
  licenseType: string;
  user: string;
  renewalDate: string;
  paymentDate: string;    // 결제일(YYYY-MM-DD) — 없으면 폴백(갱신일→오늘) 기준으로 환산됨
  annualUsd: number;
  annualKrw: number;
  // 결제일(또는 폴백 날짜) 기준 환율로 이미 환산된 연간 원화 총액(annualKrw + annualUsd×rateApplied).
  // "조회 시점 환율"이 아니라 실제 비용이 나간 시점 환율을 쓰기 위해 서버에서 미리 계산해 내려준다.
  annualKrwConverted: number;
  rateApplied: number;    // 위 환산에 실제로 쓰인 환율
  rateDate: string;       // 그 환율의 기준일(YYYY-MM-DD) — 영업일 보정으로 paymentDate와 다를 수 있음
  notionUrl: string;
  billingType?: string;  // 결제방식: "대웅" 이면 대웅 청구 항목
}

export interface SwInDept {
  swName: string;
  licenseCount: number;
  annualUsd: number;
  annualKrw: number;
  billingType?: string;
}

export interface DeptSummary {
  company: string;
  department: string;
  swCount: number;
  licenseCount: number;
  annualUsd: number;
  annualKrw: number;
  swList: SwInDept[];
}

export interface ReportData {
  rows: SubRow[];
  deptSummary: DeptSummary[];
  filters: {
    companies: string[];
    departments: string[];
    categories: string[];
  };
  totalAnnualUsd: number;
  totalAnnualKrw: number;
  hasUsdData: boolean;
  hasKrwData: boolean;
  generatedAt: string;
}
