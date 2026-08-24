import type { SaasItem } from "@/types";

export type SaasPolicySeedItem = Omit<SaasItem, "id">;

// ─────────────────────────────────────────────────────────────────────────────
// SaaS 도메인 정책 초기 시드 — 설치형 SW 정책(lib/sw-policy-seed.ts)과 별개로,
// 브라우저로 접속해서 쓰는 웹 기반 서비스를 도메인 단위로 분류한다.
//
// 도박·성인·불법 스트리밍류는 도메인이 수시로 바뀌고 실제 접속 시도가 확인된 것만
// 등록하는 게 실효성이 있어, 여기서는 카테고리 성격이 뚜렷하고 도메인이 안정적인
// 사례(웹하드·가상자산 거래소 등)만 포함했다. 나머지는 "SaaS 사용 현황"의 미확인
// 도메인 집계에서 발견되는 대로 관리자가 블랙리스트로 승격시키는 방식을 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

const items: SaasPolicySeedItem[] = [];
function add(
  status: SaasItem["status"], category: string, domain: string, name: string,
  vendor: string, description: string, alternatives: string[] = [], officialUrl?: string,
) {
  items.push({ status, category, domain, name, vendor, description, alternatives, officialUrl });
}

// ── 승인: 이미 업무에 쓰는 SaaS ──────────────────────────────
add("approved", "협업/커뮤니케이션", "worksmobile.com", "네이버웍스", "NAVER",
  "사내 메일·메신저·캘린더 표준 플랫폼");
add("approved", "협업/커뮤니케이션", "slack.com", "Slack", "Salesforce", "팀 커뮤니케이션 도구");
add("approved", "협업/커뮤니케이션", "zoom.us", "Zoom", "Zoom", "화상회의");
add("approved", "협업/문서", "notion.so", "Notion", "Notion Labs", "문서·위키·프로젝트 관리");
add("approved", "개발", "github.com", "GitHub", "Microsoft", "소스코드 저장소·협업");
add("approved", "개발", "gitlab.com", "GitLab", "GitLab", "소스코드 저장소·CI/CD");
add("approved", "개발", "vercel.com", "Vercel", "Vercel", "웹앱 배포·호스팅");
add("approved", "개발", "supabase.com", "Supabase", "Supabase", "백엔드/DB 서비스");
add("approved", "개발", "atlassian.net", "Jira/Confluence", "Atlassian", "이슈 트래킹·위키 (조직별 서브도메인)");
add("approved", "디자인", "figma.com", "Figma", "Figma", "UI/UX 디자인 협업");
add("approved", "인프라", "aws.amazon.com", "AWS 콘솔", "Amazon", "클라우드 인프라 관리");
add("approved", "인프라", "console.cloud.google.com", "GCP 콘솔", "Google", "클라우드 인프라 관리");
add("approved", "인프라", "portal.azure.com", "Azure 포털", "Microsoft", "클라우드 인프라 관리");
add("approved", "고객관리", "salesforce.com", "Salesforce", "Salesforce", "CRM");
add("approved", "고객관리", "hubspot.com", "HubSpot", "HubSpot", "CRM·마케팅 자동화");
add("approved", "인사/급여", "career.co.kr", "인크루트", "인크루트", "채용");
add("approved", "인사/급여", "saramin.co.kr", "사람인", "사람인", "채용");

// ── 조건부: 업무 목적 사용 가능하나 사전 승인 필요(정보 유출·라이선스 리스크) ──
add("conditional", "AI 도구", "chatgpt.com", "ChatGPT (웹)", "OpenAI",
  "무료/개인 계정 사용 시 입력한 사내 정보가 학습에 활용될 수 있어 기업용 계약 여부 확인 필요",
  ["기업 계약된 AI 도구"]);
add("conditional", "AI 도구", "chat.openai.com", "ChatGPT (웹, 구 도메인)", "OpenAI",
  "무료/개인 계정 사용 시 입력한 사내 정보가 학습에 활용될 수 있어 기업용 계약 여부 확인 필요");
add("conditional", "AI 도구", "claude.ai", "Claude (웹)", "Anthropic",
  "무료/개인 계정 사용 시 사내 정보 업로드 범위 확인 필요");
add("conditional", "AI 도구", "gemini.google.com", "Gemini (웹)", "Google",
  "무료/개인 계정 사용 시 사내 정보 업로드 범위 확인 필요");
add("conditional", "파일 공유", "drive.google.com", "Google Drive", "Google",
  "사내 GWS 미도입 — 개인 계정으로 회사 자료 업로드 시 관리 범위 밖에 저장됨");
add("conditional", "파일 공유", "docs.google.com", "Google Docs/Sheets/Slides", "Google",
  "사내 GWS 미도입 — 외부 협업 목적 외 사내 문서 저장 용도로는 사전 확인 필요");
add("conditional", "파일 공유", "dropbox.com", "Dropbox", "Dropbox",
  "개인 계정에 회사 자료 업로드 시 관리 범위 밖에 저장됨");
add("conditional", "파일 공유", "wetransfer.com", "WeTransfer", "WeTransfer",
  "대용량 파일 외부 전송 — 수신자·내용물 확인 필요");
add("conditional", "디자인", "canva.com", "Canva", "Canva", "웹 기반 디자인 툴 — 유료 자산 라이선스 확인 필요");
add("conditional", "디자인", "miricanvas.com", "미리캔버스", "미리디", "웹 기반 디자인 툴 — 상업적 사용 라이선스 확인 필요");
add("conditional", "번역", "deepl.com", "DeepL", "DeepL", "무료 버전 사용 시 입력 문서가 외부 서버에 전송됨 — 기밀문서 번역은 사전 확인 필요");
add("conditional", "프로젝트 관리", "trello.com", "Trello", "Atlassian", "개인 계정 사용 시 관리 범위 밖 — 팀 표준 도구(Jira/Notion) 우선 검토", ["Notion", "Jira"]);
add("conditional", "프로젝트 관리", "asana.com", "Asana", "Asana", "개인 계정 사용 시 관리 범위 밖", ["Notion", "Jira"]);
add("conditional", "원격 지원", "anydesk.com", "AnyDesk (웹)", "AnyDesk",
  "사내 승인된 원격지원 도구 외 개인 판단으로 원격 접속 허용 시 보안 리스크");
add("conditional", "가상화폐", "upbit.com", "업비트", "두나무",
  "업무시간 중 개인 자산 거래 목적 접속은 사규 확인 필요");
add("conditional", "가상화폐", "bithumb.com", "빗썸", "빗썸코리아",
  "업무시간 중 개인 자산 거래 목적 접속은 사규 확인 필요");

// ── 금지: 정보 유출·저작권·법적 리스크가 명확한 서비스 ──────
add("banned", "파일 공유(웹하드)", "webhard.co.kr", "웹하드", "PSI",
  "익명 업로드/다운로드 구조 — 사내 자료 유출 경로로 자주 지목됨");
add("banned", "파일 공유(웹하드)", "filenori.com", "파일노리", "파일노리",
  "국내 웹하드 서비스 — 사내 자료 유출 경로로 자주 지목됨");
add("banned", "파일 공유(웹하드)", "todayfile.com", "투데이파일", "투데이파일",
  "국내 웹하드 서비스 — 사내 자료 유출 경로로 자주 지목됨");
add("banned", "파일 공유(대용량 업로드)", "mega.nz", "MEGA", "Mega Limited",
  "익명 대용량 업로드 — 자료 유출·불법 콘텐츠 공유 경로로 자주 지목됨");
add("banned", "저작권 침해", "torrentkim.torrentkim6.com", "토렌트킴", "-",
  "저작권 침해 콘텐츠 공유 사이트");

// ── 예외: 회사 자체 시스템 — 승인/금지 판정 대상이 아님(제3자 SaaS 아님) ──
add("excluded", "사내 시스템", "idstrust.com", "회사 홈페이지/메일 도메인", "idsTrust",
  "회사 자체 도메인 — 제3자 SaaS 판정 대상 아님");
add("excluded", "사내 시스템", "assetify-desk.vercel.app", "자산실사 포털", "idsTrust",
  "사내 자체 구축 시스템 — 제3자 SaaS 판정 대상 아님");

export const SAAS_POLICY_SEED: SaasPolicySeedItem[] = items;
