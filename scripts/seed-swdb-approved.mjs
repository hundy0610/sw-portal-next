/**
 * 기업용 권장 소프트웨어 마스터 리스트 — approved 항목 추가
 * node scripts/seed-swdb-approved.mjs
 */
import Redis from "ioredis";

const REDIS_URL = "redis://default:A7dsOsfhH4f5tcusiFGSFsU5FdNuES2y@redis-14310.crce220.us-east-1-4.ec2.cloud.redislabs.com:14310";

const NEW_APPROVED = [
  // ── 1. 사무 및 생산성 ──────────────────────────────────────────────
  {
    id: "sw_a_ofc_001", name: "OnlyOffice", vendor: "Ascensio System SIA",
    category: "사무 및 생산성",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["LibreOffice", "Microsoft Office"],
    mandatory: false,
    description: "MS Office와 UI·파일 포맷 호환성이 뛰어난 오픈소스 오피스. .docx/.xlsx/.pptx 완벽 호환. 기업 사용 무료.",
  },
  {
    id: "sw_a_ofc_002", name: "Sumatra PDF", vendor: "Krzysztof Kowalczyk",
    category: "사무 및 생산성",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["PDF24 Creator"],
    mandatory: false,
    description: "매우 가볍고 빠른 PDF 뷰어. 광고 없음. 설치 불필요 포터블 버전 제공. 기업 사용 무료.",
  },

  // ── 2. 개발 및 데이터 분석 ────────────────────────────────────────
  {
    id: "sw_a_dev_001", name: "DBeaver Community", vendor: "DBeaver Corp",
    category: "개발 및 데이터 분석",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "MySQL, PostgreSQL, Oracle, MSSQL 등 거의 모든 DB를 지원하는 통합 DB 관리 도구. Community Edition 기업 무료.",
  },
  {
    id: "sw_a_dev_002", name: "Git / GitHub Desktop", vendor: "Git SCM / GitHub",
    category: "개발 및 데이터 분석",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "소스코드 버전 관리 및 협업 필수 도구. Git CLI + GitHub Desktop GUI 모두 기업 사용 무료.",
  },
  {
    id: "sw_a_dev_003", name: "Tabby / Windows Terminal", vendor: "Eugene Pankov / Microsoft",
    category: "개발 및 데이터 분석",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "고성능 터미널 환경 도구. Tabby는 SSH/멀티 탭 지원, Windows Terminal은 MS 공식 터미널. 모두 무료.",
  },
  {
    id: "sw_a_dev_004", name: "Python (Anaconda)", vendor: "Anaconda Inc.",
    category: "개발 및 데이터 분석",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "데이터 분석 및 업무 자동화 필수 환경. Anaconda 개인·소규모 기업 무료. 200인 이상 기업은 Individual Edition 별도 확인 필요.",
  },
  {
    id: "sw_a_dev_005", name: "Apache Superset", vendor: "Apache Software Foundation",
    category: "개발 및 데이터 분석",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "기업용 데이터 시각화 및 BI 대시보드 오픈소스 도구. Apache 라이선스(상업적 사용 완전 무료).",
  },

  // ── 3. 디자인 및 그래픽 ───────────────────────────────────────────
  {
    id: "sw_a_des_001", name: "Blender", vendor: "Blender Foundation",
    category: "디자인 및 그래픽",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "3D 모델링, 애니메이션, 영상 합성 업계 표준 오픈소스. GPL 라이선스로 상업적 이용 완전 무료.",
  },
  {
    id: "sw_a_des_002", name: "Krita", vendor: "Krita Foundation",
    category: "디자인 및 그래픽",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["GIMP"],
    mandatory: false,
    description: "드로잉·페인팅 전문 오픈소스 도구. 디지털 일러스트 및 컨셉아트 작업에 특화. 상업적 사용 무료.",
  },
  {
    id: "sw_a_des_003", name: "Scribus", vendor: "Scribus Team",
    category: "디자인 및 그래픽",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "전자 출판(DTP) 및 레이아웃 편집 오픈소스 도구. 카탈로그·뉴스레터·보고서 제작. 상업적 사용 무료.",
  },

  // ── 4. 영상 및 미디어 ─────────────────────────────────────────────
  {
    id: "sw_a_vid_001", name: "DaVinci Resolve (Free)", vendor: "Blackmagic Design",
    category: "영상 및 미디어",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["Shotcut"],
    mandatory: false,
    description: "전문가급 영상 편집·색보정 도구. Free 버전도 상업적 이용 허용. 사내 홍보영상·교육영상 제작에 활용 가능.",
  },
  {
    id: "sw_a_vid_002", name: "OBS Studio", vendor: "OBS Project",
    category: "영상 및 미디어",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "사내 방송, 화면 녹화, 화상회의 녹화 표준 오픈소스. GPL 라이선스로 상업적 사용 완전 무료.",
  },
  {
    id: "sw_a_vid_003", name: "Shotcut", vendor: "Meltytech",
    category: "영상 및 미디어",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["DaVinci Resolve (Free)"],
    mandatory: false,
    description: "빠르고 직관적인 오픈소스 영상 편집기. 간단한 영상 편집에 적합. 상업적 사용 무료.",
  },
  {
    id: "sw_a_vid_004", name: "HandBrake", vendor: "HandBrake Team",
    category: "영상 및 미디어",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "영상 인코딩 및 파일 용량 최적화 오픈소스 도구. 대용량 영상 파일 압축·변환에 사용. 상업적 사용 무료.",
  },

  // ── 5. 압축 및 시스템 관리 ────────────────────────────────────────
  {
    id: "sw_a_sys_001", name: "PeaZip", vendor: "Giorgio Tani",
    category: "압축 및 시스템 관리",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["7-Zip"],
    mandatory: false,
    description: "7-Zip 기반 오픈소스 압축 프로그램. 직관적인 UI 제공. 200+ 포맷 지원. 상업적 사용 무료.",
  },
  {
    id: "sw_a_sys_002", name: "Microsoft PowerToys", vendor: "Microsoft",
    category: "압축 및 시스템 관리",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "MS 공식 무료 유틸리티 모음. 창 배치(FancyZones), 일괄 이름변경, 색상 선택기, 텍스트 추출 등 업무 생산성 극대화.",
  },
  {
    id: "sw_a_sys_003", name: "ShareX", vendor: "ShareX Team",
    category: "압축 및 시스템 관리",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "화면 캡처, 스크롤 캡처, 녹화, OCR(글자 인식) 기능을 포함한 올인원 스크린샷 도구. 상업적 사용 무료.",
  },

  // ── 6. 기획 및 노트 ───────────────────────────────────────────────
  {
    id: "sw_a_pln_001", name: "Draw.io (diagrams.net)", vendor: "JGraph Ltd",
    category: "기획 및 노트",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "플로우차트, ERD, 조직도, 시스템 아키텍처 작성 도구. 완전 무료. 데스크톱 앱 및 웹 모두 사용 가능.",
  },
  {
    id: "sw_a_pln_002", name: "Joplin", vendor: "Laurent Cozic",
    category: "기획 및 노트",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: [],
    mandatory: false,
    description: "데이터가 PC 로컬에 저장되는 보안 마크다운 노트 앱. 에버노트 대체. 외부 서버 전송 없어 정보 유출 위험 낮음.",
  },
  {
    id: "sw_a_pln_003", name: "Logseq", vendor: "Logseq Inc.",
    category: "기획 및 노트",
    status: "approved", totalLicenses: 999, usedLicenses: 0,
    alternatives: ["Joplin"],
    mandatory: false,
    description: "로컬 파일 기반 지식 관리(PKM) 도구. 모든 데이터가 PC에 저장. 마크다운 기반 양방향 링크 노트. 무료.",
  },
];

async function run() {
  const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  try {
    const raw = await client.get("portal:swdb");
    const existing = raw ? JSON.parse(raw) : [];
    const existingNames = new Set(existing.map(i => i.name.toLowerCase()));

    const toAdd = NEW_APPROVED.filter(i => !existingNames.has(i.name.toLowerCase()));
    const skipped = NEW_APPROVED.filter(i => existingNames.has(i.name.toLowerCase()));

    const merged = [...existing, ...toAdd];
    await client.set("portal:swdb", JSON.stringify(merged));

    console.log(`\n✅ 완료: 기존 ${existing.length}건 → 총 ${merged.length}건`);
    console.log(`   추가: ${toAdd.length}건 / 스킵(중복): ${skipped.length}건`);
    if (skipped.length) console.log("   스킵:", skipped.map(i => i.name).join(", "));
    console.log("\n추가된 항목:");
    toAdd.forEach(i => console.log(`   ✅ [${i.category}] ${i.name}`));
  } finally {
    await client.quit();
  }
}

run().catch(e => { console.error("❌", e); process.exit(1); });
