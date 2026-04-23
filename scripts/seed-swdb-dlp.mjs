/**
 * DLP 차단 프로세스_20260407.xlsx 기반 금지 SW 항목 추가
 * node scripts/seed-swdb-dlp.mjs
 */
import Redis from "ioredis";

const REDIS_URL = "redis://default:A7dsOsfhH4f5tcusiFGSFsU5FdNuES2y@redis-14310.crce220.us-east-1-4.ec2.cloud.redislabs.com:14310";
const now = new Date().toISOString();

const NEW_BANNED = [
  // ── P2P ───────────────────────────────────────────────────────────
  {
    id: "sw_b_p2p_001", name: "qBittorrent", vendor: "qBittorrent.org",
    category: "P2P", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: [], mandatory: false,
    description: "P2P 파일 공유 프로그램. 저작권 침해 및 악성코드 유포 경로로 악용될 수 있어 DLP 정책상 설치·실행 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_p2p_002", name: "BitComet", vendor: "BitComet",
    category: "P2P", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: [], mandatory: false,
    description: "BitTorrent 기반 P2P 프로그램. 비인가 콘텐츠 다운로드 및 정보 유출 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_p2p_003", name: "eMule", vendor: "eMule Project",
    category: "P2P", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: [], mandatory: false,
    description: "eDonkey 네트워크 기반 P2P 클라이언트. 저작권 침해 및 보안 위협으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_p2p_004", name: "Vuze (Azureus)", vendor: "Azureus Software",
    category: "P2P", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: [], mandatory: false,
    description: "BitTorrent 클라이언트. P2P 네트워크를 통한 비인가 콘텐츠 배포 경로로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_p2p_005", name: "WebTorrent", vendor: "WebTorrent",
    category: "P2P", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: [], mandatory: false,
    description: "웹 기반 토렌트 클라이언트. P2P 데이터 전송 보안 위협으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_p2p_006", name: "RaiDrive", vendor: "RaiDrive",
    category: "P2P / 클라우드", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: [], mandatory: false,
    description: "클라우드 스토리지를 드라이브로 마운트하는 P2P 기반 앱. 내부 데이터 외부 유출 경로가 될 수 있어 차단.",
    notionUrl: "",
  },

  // ── 메신저 ─────────────────────────────────────────────────────────
  {
    id: "sw_b_msg_001", name: "Discord", vendor: "Discord Inc.",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams", "사내 메신저"], mandatory: false,
    description: "게임·커뮤니티용 VoIP 메신저. 비인가 외부 채널을 통한 파일 공유·정보 유출 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_002", name: "Telegram", vendor: "Telegram FZ LLC",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams", "사내 메신저"], mandatory: false,
    description: "강력한 암호화 기능으로 DLP 모니터링이 불가한 메신저. 기업 정보 유출 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_003", name: "WhatsApp", vendor: "Meta Platforms",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams", "사내 메신저"], mandatory: false,
    description: "개인용 모바일 메신저. 업무용 문서·사진 비인가 외부 전송 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_004", name: "Signal", vendor: "Signal Foundation",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams"], mandatory: false,
    description: "종단간 암호화 메신저. DLP 콘텐츠 검사 우회 가능성으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_005", name: "KakaoTalk", vendor: "Kakao Corp.",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams", "사내 메신저"], mandatory: false,
    description: "국내 개인용 메신저. 업무 자료 외부 전송 및 보안 감사 미적용으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_006", name: "LINE", vendor: "LINE Corporation",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams"], mandatory: false,
    description: "개인용 모바일 메신저. 비인가 파일 공유 및 외부 채널 통신 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_007", name: "Skype (개인 계정)", vendor: "Microsoft",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams"], mandatory: false,
    description: "개인 계정 Skype 사용은 차단. 업무용 화상회의는 Microsoft Teams를 사용할 것.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_008", name: "WeChat (위챗)", vendor: "Tencent",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams"], mandatory: false,
    description: "중국산 메신저. 개인정보·기업정보 수집 및 외부 서버 전송 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_009", name: "Viber", vendor: "Rakuten Viber",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams"], mandatory: false,
    description: "개인용 VoIP 메신저. 비인가 외부 채널 통신 및 파일 공유 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_msg_010", name: "NATE ON (네이트온)", vendor: "SK Communications",
    category: "메신저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Teams", "사내 메신저"], mandatory: false,
    description: "개인용 메신저. 사내 승인된 협업 도구 외 외부 메신저 사용 금지 정책에 따라 차단.",
    notionUrl: "",
  },

  // ── 브라우저 ────────────────────────────────────────────────────────
  {
    id: "sw_b_brw_001", name: "Mozilla Firefox", vendor: "Mozilla Foundation",
    category: "브라우저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Edge", "Google Chrome"], mandatory: false,
    description: "사내 표준 브라우저(Chrome/Edge) 이외 브라우저는 DLP 정책 적용 불가로 차단. 업무용 표준 브라우저를 사용할 것.",
    notionUrl: "",
  },
  {
    id: "sw_b_brw_002", name: "Opera", vendor: "Opera Software",
    category: "브라우저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Edge", "Google Chrome"], mandatory: false,
    description: "사내 비표준 브라우저. VPN 내장 기능으로 DLP 우회 가능성이 있어 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_brw_003", name: "Brave", vendor: "Brave Software",
    category: "브라우저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Edge", "Google Chrome"], mandatory: false,
    description: "프라이버시 중심 브라우저. 광고 차단·핑거프린팅 방지 기능이 보안 모니터링을 방해할 수 있어 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_brw_004", name: "Vivaldi", vendor: "Vivaldi Technologies",
    category: "브라우저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Edge", "Google Chrome"], mandatory: false,
    description: "사내 비표준 브라우저. 표준 브라우저 외 사용은 보안 정책 상 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_brw_005", name: "Naver Whale (웨일)", vendor: "Naver",
    category: "브라우저", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Microsoft Edge", "Google Chrome"], mandatory: false,
    description: "사내 비표준 브라우저. 표준 브라우저 외 사용은 보안 정책 상 차단.",
    notionUrl: "",
  },

  // ── 원격제어 ───────────────────────────────────────────────────────
  {
    id: "sw_b_rmt_001", name: "AnyDesk", vendor: "AnyDesk Software",
    category: "원격제어", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Windows 원격 데스크톱(사내 승인된 VPN 사용)"], mandatory: false,
    description: "비인가 원격 접속 도구. 외부에서 사내 PC 무단 접근 경로가 될 수 있어 차단. IT팀 승인 없이 사용 불가.",
    notionUrl: "",
  },
  {
    id: "sw_b_rmt_002", name: "TeamViewer", vendor: "TeamViewer AG",
    category: "원격제어", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Windows 원격 데스크톱(사내 승인된 VPN 사용)"], mandatory: false,
    description: "개인 무료 버전 업무 사용 차단. 사외 원격 접속 보안 위험 및 라이선스 위반 가능성. IT팀 승인 필요.",
    notionUrl: "",
  },
  {
    id: "sw_b_rmt_003", name: "Splashtop", vendor: "Splashtop Inc.",
    category: "원격제어", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Windows 원격 데스크톱(사내 승인된 VPN 사용)"], mandatory: false,
    description: "비인가 원격 접속 솔루션. 외부 서버를 경유하는 원격 접속은 데이터 유출 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_rmt_004", name: "RealVNC", vendor: "RealVNC Ltd.",
    category: "원격제어", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Windows 원격 데스크톱(사내 승인된 VPN 사용)"], mandatory: false,
    description: "VNC 기반 원격 제어 도구. 비암호화 연결 시 내부 화면 정보 노출 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_rmt_005", name: "UltraVNC / TightVNC", vendor: "VNC Project",
    category: "원격제어", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["Windows 원격 데스크톱(사내 승인된 VPN 사용)"], mandatory: false,
    description: "오픈소스 VNC 클라이언트. 비인가 원격 접속 보안 위험으로 차단.",
    notionUrl: "",
  },

  // ── 웹하드 / 클라우드 ──────────────────────────────────────────────
  {
    id: "sw_b_cld_001", name: "Dropbox", vendor: "Dropbox Inc.",
    category: "클라우드 스토리지", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["사내 승인 클라우드 스토리지", "SharePoint"], mandatory: false,
    description: "개인 클라우드 스토리지. 사내 기밀 문서·파일의 외부 서버 자동 동기화로 정보 유출 위험. 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_cld_002", name: "MEGA (MEGAsync)", vendor: "Mega Limited",
    category: "클라우드 스토리지", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["사내 승인 클라우드 스토리지"], mandatory: false,
    description: "종단간 암호화 클라우드 스토리지. DLP 콘텐츠 검사 불가 및 대용량 파일 외부 유출 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_cld_003", name: "TeraBox (테라박스)", vendor: "Flextech Inc.",
    category: "클라우드 스토리지", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["사내 승인 클라우드 스토리지"], mandatory: false,
    description: "중국 계열 무료 클라우드 스토리지(1TB). 개인정보·기업정보 해외 서버 저장 위험으로 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_cld_004", name: "Baidu NetDisk (바이두)", vendor: "Baidu",
    category: "클라우드 스토리지", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["사내 승인 클라우드 스토리지"], mandatory: false,
    description: "중국 바이두 클라우드 스토리지. 중국 법률에 따른 당국 데이터 제공 의무로 기업 정보 유출 위험. 차단.",
    notionUrl: "",
  },
  {
    id: "sw_b_cld_005", name: "Naver N드라이브", vendor: "Naver",
    category: "클라우드 스토리지", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["사내 승인 클라우드 스토리지"], mandatory: false,
    description: "개인용 클라우드 드라이브. 업무 파일의 개인 계정 동기화로 인한 정보 유출 위험으로 차단.",
    notionUrl: "",
  },

  // ── AI 프로그램 ────────────────────────────────────────────────────
  {
    id: "sw_b_ai_001", name: "OpenClaw (AI 에이전트)", vendor: "OpenClaw",
    category: "AI", status: "banned", totalLicenses: 0, usedLicenses: 0,
    alternatives: ["사내 승인 AI 도구"], mandatory: false,
    description: "비인가 AI 에이전트 프로그램. 업무 데이터 외부 AI 서버 전송 및 자율 실행 위험으로 차단. IT팀 승인 필요.",
    notionUrl: "",
  },
];

async function run() {
  const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  try {
    const raw = await client.get("portal:swdb");
    const existing = raw ? JSON.parse(raw) : [];

    // Firefox는 이미 approved로 있으면 banned로 업데이트
    const updated = existing.map(item => {
      if (item.name === "Mozilla Firefox") {
        console.log("⚠️  Mozilla Firefox: approved → banned (DLP 차단 브라우저)");
        return {
          ...item,
          status: "banned",
          description: "사내 표준 브라우저(Chrome/Edge) 이외 브라우저는 DLP 정책 적용 불가로 차단. 업무용 표준 브라우저를 사용할 것.",
          alternatives: ["Microsoft Edge", "Google Chrome"],
        };
      }
      return item;
    });

    // 중복 제거 (id 또는 name 기준)
    const existingIds  = new Set(updated.map(i => i.id));
    const existingNames = new Set(updated.map(i => i.name.toLowerCase()));
    const toAdd = NEW_BANNED.filter(
      i => !existingIds.has(i.id) && !existingNames.has(i.name.toLowerCase())
    );

    const merged = [...updated, ...toAdd];
    await client.set("portal:swdb", JSON.stringify(merged));

    console.log(`\n✅ 완료: 기존 ${existing.length}건 → 총 ${merged.length}건`);
    console.log(`   추가: ${toAdd.length}건 / 스킵(중복): ${NEW_BANNED.length - toAdd.length}건`);
    console.log("\n추가된 항목:");
    toAdd.forEach(i => console.log(`   🚫 [${i.category}] ${i.name}`));
  } finally {
    await client.quit();
  }
}

run().catch(e => { console.error("❌", e); process.exit(1); });
