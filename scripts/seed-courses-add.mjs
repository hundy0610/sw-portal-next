/**
 * 교육센터 추가 5개 — 기존 데이터 유지하며 append
 * node scripts/seed-courses-add.mjs
 */
import Redis from "ioredis";

const REDIS_URL = "redis://default:A7dsOsfhH4f5tcusiFGSFsU5FdNuES2y@redis-14310.crce220.us-east-1-4.ec2.cloud.redislabs.com:14310";
const now = new Date().toISOString();

const NEW_COURSES = [
  {
    id: "c_edu_006",
    title: "SW 자산 관리(SAM)란 무엇인가?",
    description: "Software Asset Management(SAM)는 기업이 보유한 모든 SW 라이선스를 체계적으로 파악·관리하는 프로세스입니다. SAM 미도입 기업은 BSA 감사 시 평균 58%가 미준수 판정을 받습니다. 이 과정에서 SAM의 개념, 도입 효과, 기본 절차를 배웁니다.",
    deadline: "2025-12-31",
    duration: "35분",
    courseUrl: "https://www.bsa.org/ko/resources/reports/software-asset-management",
    category: "required",
    thumbnailUrl: "",
    order: 5,
    visible: true,
    createdAt: now,
  },
  {
    id: "c_edu_007",
    title: "클라우드·구독형 SaaS 라이선스 관리",
    description: "Microsoft 365, Adobe Creative Cloud, Zoom, Slack 등 구독형 SW는 '사용자 단위' 계약이 일반적입니다. 퇴사자 계정 미회수, 무단 공유 계정 사용, 초과 사용자 발생 시 계약 위반 및 추가 비용이 발생합니다. 구독 SW의 라이선스 최적화 방법을 안내합니다.",
    deadline: "2025-12-31",
    duration: "30분",
    courseUrl: "https://www.microsoft.com/ko-kr/licensing/learn-more",
    category: "required",
    thumbnailUrl: "",
    order: 6,
    visible: true,
    createdAt: now,
  },
  {
    id: "c_edu_008",
    title: "SW 구매 신청 절차 및 공식 채널 안내",
    description: "업무에 SW가 필요할 때 개인 결제·무단 설치가 아닌 공식 구매 절차를 이용해야 합니다. 비공식 경로로 구매한 라이선스는 기업 자산으로 인정되지 않으며 환불·이전이 불가합니다. 사내 SW 신청 경로, 승인 프로세스, 예산 처리 방법을 안내합니다.",
    deadline: "2025-12-31",
    duration: "20분",
    courseUrl: "#",
    category: "policy",
    thumbnailUrl: "",
    order: 7,
    visible: true,
    createdAt: now,
  },
  {
    id: "c_edu_009",
    title: "프리웨어·셰어웨어의 올바른 구분법",
    description: "무료(Freeware)처럼 보여도 상업적 사용이 금지된 SW가 많습니다. Freeware(완전 무료) / Shareware(기간 제한 평가판) / Freemium(기능 제한 무료) / Open Source를 구분하는 기준과, 안전한 무료 SW를 선택하는 체크리스트를 제공합니다.",
    deadline: "2025-12-31",
    duration: "25분",
    courseUrl: "https://olis.or.kr/license/licenseGuide.do",
    category: "material",
    thumbnailUrl: "",
    order: 8,
    visible: true,
    createdAt: now,
  },
  {
    id: "c_edu_010",
    title: "SW 라이선스 감사(Audit) 대비 및 대응 요령",
    description: "BSA·FAST·벤더 직접 감사는 예고 없이 진행될 수 있습니다. 감사 통보 수령 → 설치 현황 파악 → 법무 검토 → 합의·구매 단계별 대응 방법을 안내합니다. 사전 대비 체크리스트와 실제 감사 대응 공문 사례를 포함합니다.",
    deadline: "2025-12-31",
    duration: "40분",
    courseUrl: "https://www.bsa.org/ko/resources/reports",
    category: "policy",
    thumbnailUrl: "",
    order: 9,
    visible: true,
    createdAt: now,
  },
];

async function addCourses() {
  const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  try {
    const raw = await client.get("portal:courses");
    const existing = raw ? JSON.parse(raw) : [];
    const merged = [...existing, ...NEW_COURSES];
    await client.set("portal:courses", JSON.stringify(merged));
    console.log(`✅ 교육 추가 완료: 기존 ${existing.length}건 + 신규 ${NEW_COURSES.length}건 = 총 ${merged.length}건`);
    NEW_COURSES.forEach(c => console.log(`   · [${c.category}] ${c.title} (${c.duration})`));
  } finally {
    await client.quit();
  }
}

addCourses().catch(e => { console.error("❌", e); process.exit(1); });
