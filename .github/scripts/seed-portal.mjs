/**
 * .github/scripts/seed-portal.mjs
 *
 * 포털 관리 데이터 초기 등록 스크립트
 * GitHub Actions seed-portal.yml 에서 수동 실행
 *
 * 등록 대상:
 *   portal:swdb      — SW 검색 (승인/차단/조건부)
 *   portal:resources — 자료실 (오픈소스 설치 링크)
 *   portal:courses   — 교육센터 필수교육 4개
 *
 * 환경변수:
 *   UPSTASH_REDIS_REST_URL    — Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis REST Token
 */

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL)   { console.error("❌ UPSTASH_REDIS_REST_URL 미설정"); process.exit(1); }
if (!UPSTASH_TOKEN) { console.error("❌ UPSTASH_REDIS_REST_TOKEN 미설정"); process.exit(1); }

const now = new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// SW 검색 데이터 (portal:swdb)
// ─────────────────────────────────────────────────────────────────────────────
const SW_ITEMS = [

  // ── 차단 SW: P2P ─────────────────────────────────────────────────────────
  {
    id: "sw_block_p2p_utorrent", name: "uTorrent (µTorrent)", vendor: "BitTorrent Inc.",
    category: "P2P 파일공유", status: "blocked",
    alternatives: ["OneDrive", "SharePoint"],
    mandatory: false,
    description: "P2P 파일공유 프로그램. 저작권 침해 파일 유통 위험. 기업 보안정책상 사용 금지.",
    officialUrl: "https://www.utorrent.com",
  },
  {
    id: "sw_block_p2p_qbittorrent", name: "qBittorrent", vendor: "The qBittorrent Project",
    category: "P2P 파일공유", status: "blocked",
    alternatives: ["OneDrive", "SharePoint"],
    mandatory: false,
    description: "오픈소스 P2P 파일공유 클라이언트. 기업 네트워크 보안 및 저작권 정책 위반으로 사용 금지.",
    officialUrl: "https://www.qbittorrent.org",
  },
  {
    id: "sw_block_p2p_bitcomet", name: "BitComet", vendor: "CometNetwork",
    category: "P2P 파일공유", status: "blocked",
    alternatives: ["OneDrive"],
    mandatory: false,
    description: "BitTorrent/HTTP 복합 다운로드 프로그램. 기업 보안정책상 사용 금지.",
    officialUrl: "https://www.bitcomet.com",
  },
  {
    id: "sw_block_p2p_emule", name: "eMule / 당나귀", vendor: "eMule Project",
    category: "P2P 파일공유", status: "blocked",
    alternatives: [],
    mandatory: false,
    description: "eD2k/Kad 네트워크 기반 P2P 프로그램. 기업 보안정책상 사용 금지.",
    officialUrl: "https://www.emule-project.net",
  },
  {
    id: "sw_block_p2p_raidrive", name: "RaiDrive (라이드라이브)", vendor: "OpenBoxLab",
    category: "P2P 파일공유", status: "blocked",
    alternatives: ["OneDrive", "SharePoint"],
    mandatory: false,
    description: "NAS/클라우드 드라이브 마운트 도구. 외부 저장소 무단 연결 위험으로 사용 금지.",
    officialUrl: "https://www.raidrive.com",
  },
  {
    id: "sw_block_p2p_sendanywhere", name: "Send Anywhere (센드애니웨어)", vendor: "Estmob Inc.",
    category: "P2P 파일공유", status: "blocked",
    alternatives: ["OneDrive", "이메일"],
    mandatory: false,
    description: "P2P 파일 전송 앱. 기업 내부 데이터 외부 유출 위험으로 사용 금지.",
    officialUrl: "https://send-anywhere.com",
  },

  // ── 차단 SW: 메신저 ───────────────────────────────────────────────────────
  {
    id: "sw_block_msg_kakao", name: "카카오톡 (KakaoTalk)", vendor: "Kakao Corp.",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams", "사내 메신저"],
    mandatory: false,
    description: "개인용 모바일 메신저. 업무용 PC에서 사용 금지. 사내 공식 메신저(Microsoft Teams) 사용 권장.",
    officialUrl: "https://www.kakaocorp.com",
  },
  {
    id: "sw_block_msg_telegram", name: "텔레그램 (Telegram)", vendor: "Telegram FZ-LLC",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "암호화 메신저 앱. 서버가 해외에 위치하여 기업 정보보안 정책상 사용 금지.",
    officialUrl: "https://telegram.org",
  },
  {
    id: "sw_block_msg_discord", name: "Discord (디스코드)", vendor: "Discord Inc.",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "게임/커뮤니티용 음성·채팅 플랫폼. 기업 보안정책상 사용 금지.",
    officialUrl: "https://discord.com",
  },
  {
    id: "sw_block_msg_line", name: "LINE (라인)", vendor: "LINE Corp.",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "일본 기반 메신저 앱. 개인 정보 및 업무 데이터 유출 위험으로 사용 금지.",
    officialUrl: "https://line.me",
  },
  {
    id: "sw_block_msg_wechat", name: "WeChat (위챗)", vendor: "Tencent",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "중국 기반 메신저. 데이터 보안 및 개인정보 보호법 위험으로 사용 금지.",
    officialUrl: "https://www.wechat.com",
  },
  {
    id: "sw_block_msg_whatsapp", name: "WhatsApp", vendor: "Meta Platforms",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "개인용 메신저. 기업 내 업무 데이터 취급 금지.",
    officialUrl: "https://www.whatsapp.com",
  },
  {
    id: "sw_block_msg_skype", name: "Skype (스카이프)", vendor: "Microsoft",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "개인용 화상통화/메신저. Microsoft Teams로 통합 대체. 개인용 Skype 사용 금지.",
    officialUrl: "https://www.skype.com",
  },
  {
    id: "sw_block_msg_signal", name: "Signal (시그널)", vendor: "Signal Foundation",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "암호화 메신저. 기업 보안정책상 외부 메신저 사용 금지.",
    officialUrl: "https://signal.org",
  },
  {
    id: "sw_block_msg_nateon", name: "네이트온 (NateOn)", vendor: "SK Communications",
    category: "메신저", status: "blocked",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "국내 개인용 메신저. 사내 공식 메신저 정책에 따라 사용 금지.",
    officialUrl: "https://nateon.skcomms.co.kr",
  },

  // ── 차단 SW: 브라우저 ─────────────────────────────────────────────────────
  {
    id: "sw_block_browser_firefox", name: "Mozilla Firefox", vendor: "Mozilla Foundation",
    category: "브라우저", status: "blocked",
    alternatives: ["Google Chrome", "Microsoft Edge"],
    mandatory: false,
    description: "오픈소스 웹 브라우저. 기업 표준 브라우저(Chrome/Edge) 정책으로 사용 제한.",
    officialUrl: "https://www.mozilla.org/firefox",
  },
  {
    id: "sw_block_browser_brave", name: "Brave", vendor: "Brave Software",
    category: "브라우저", status: "blocked",
    alternatives: ["Google Chrome", "Microsoft Edge"],
    mandatory: false,
    description: "광고 차단 내장 브라우저. 기업 표준 브라우저 정책으로 사용 금지.",
    officialUrl: "https://brave.com",
  },
  {
    id: "sw_block_browser_opera", name: "Opera", vendor: "Opera Software",
    category: "브라우저", status: "blocked",
    alternatives: ["Google Chrome", "Microsoft Edge"],
    mandatory: false,
    description: "중국 기업 소유 브라우저. 데이터 보안 정책상 사용 금지.",
    officialUrl: "https://www.opera.com",
  },
  {
    id: "sw_block_browser_whale", name: "네이버 웨일 (Whale)", vendor: "Naver Corp.",
    category: "브라우저", status: "blocked",
    alternatives: ["Google Chrome", "Microsoft Edge"],
    mandatory: false,
    description: "네이버 웨일 브라우저. 기업 표준 브라우저 정책으로 사용 제한.",
    officialUrl: "https://whale.naver.com",
  },

  // ── 차단 SW: 원격접속 ─────────────────────────────────────────────────────
  {
    id: "sw_block_remote_teamviewer", name: "TeamViewer", vendor: "TeamViewer AG",
    category: "원격접속", status: "blocked",
    alternatives: ["Windows 원격 데스크톱(RDP)", "사내 승인 원격접속 솔루션"],
    mandatory: false,
    description: "상용 원격접속 솔루션. 기업 환경에서 라이선스 비용 및 보안 위험으로 사용 금지. 승인된 원격접속 솔루션 사용 필수.",
    officialUrl: "https://www.teamviewer.com",
  },
  {
    id: "sw_block_remote_anydesk", name: "AnyDesk", vendor: "AnyDesk Software GmbH",
    category: "원격접속", status: "blocked",
    alternatives: ["Windows 원격 데스크톱(RDP)"],
    mandatory: false,
    description: "원격 데스크톱 소프트웨어. 기업 보안정책상 미승인 원격접속 도구 사용 금지.",
    officialUrl: "https://anydesk.com",
  },
  {
    id: "sw_block_remote_splashtop", name: "Splashtop", vendor: "Splashtop Inc.",
    category: "원격접속", status: "blocked",
    alternatives: ["Windows 원격 데스크톱(RDP)"],
    mandatory: false,
    description: "원격 접속/지원 솔루션. 미승인 원격접속 도구 사용 금지.",
    officialUrl: "https://www.splashtop.com",
  },
  {
    id: "sw_block_remote_vnc", name: "RealVNC / TightVNC / UltraVNC", vendor: "VNC 계열",
    category: "원격접속", status: "blocked",
    alternatives: ["Windows 원격 데스크톱(RDP)"],
    mandatory: false,
    description: "VNC 기반 원격접속 도구 전체. 기업 보안정책상 사용 금지.",
    officialUrl: "https://www.realvnc.com",
  },

  // ── 차단 SW: 클라우드/파일도 ─────────────────────────────────────────────
  {
    id: "sw_block_cloud_dropbox", name: "Dropbox", vendor: "Dropbox Inc.",
    category: "외부 클라우드", status: "blocked",
    alternatives: ["Microsoft OneDrive", "SharePoint"],
    mandatory: false,
    description: "개인용 클라우드 스토리지. 기업 문서/데이터 외부 저장 금지. Microsoft OneDrive 사용 권장.",
    officialUrl: "https://www.dropbox.com",
  },
  {
    id: "sw_block_cloud_mega", name: "MEGA (메가)", vendor: "Mega Limited",
    category: "외부 클라우드", status: "blocked",
    alternatives: ["Microsoft OneDrive"],
    mandatory: false,
    description: "암호화 클라우드 스토리지. 기업 데이터 외부 저장 금지.",
    officialUrl: "https://mega.io",
  },
  {
    id: "sw_block_cloud_terabox", name: "TeraBox (테라박스)", vendor: "Flextech Inc.",
    category: "외부 클라우드", status: "blocked",
    alternatives: ["Microsoft OneDrive"],
    mandatory: false,
    description: "중국 기반 클라우드 서비스. 데이터 보안 위험으로 사용 금지.",
    officialUrl: "https://terabox.com",
  },
  {
    id: "sw_block_cloud_baidu", name: "바이두 넷디스크 (Baidu Netdisk)", vendor: "Baidu Inc.",
    category: "외부 클라우드", status: "blocked",
    alternatives: ["Microsoft OneDrive"],
    mandatory: false,
    description: "중국 바이두 클라우드 서비스. 기업 데이터 보안 및 개인정보 보호법 위반 위험.",
    officialUrl: "https://pan.baidu.com",
  },

  // ── 승인 SW: 오피스 ───────────────────────────────────────────────────────
  {
    id: "sw_ok_libreoffice", name: "LibreOffice", vendor: "The Document Foundation",
    category: "오피스", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "완전 무료 오픈소스 오피스 스위트(Writer/Calc/Impress). MPL 2.0 라이선스로 기업 무제한 사용 가능. MS Office 문서 호환.",
    officialUrl: "https://www.libreoffice.org",
  },
  {
    id: "sw_ok_onlyoffice", name: "ONLYOFFICE Community", vendor: "Ascensio System SIA",
    category: "오피스", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "오픈소스 오피스 편집기. MS Office 형식 완벽 호환. Community 버전 무료 사용 가능.",
    officialUrl: "https://www.onlyoffice.com",
  },

  // ── 승인 SW: 브라우저 ─────────────────────────────────────────────────────
  {
    id: "sw_ok_chrome", name: "Google Chrome", vendor: "Google LLC",
    category: "브라우저", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "기업 표준 브라우저. 무료 사용 가능. 기업 정책 관리(Google Workspace) 연동 지원.",
    officialUrl: "https://www.google.com/chrome",
  },
  {
    id: "sw_ok_edge", name: "Microsoft Edge", vendor: "Microsoft",
    category: "브라우저", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "Windows 기본 브라우저. Microsoft 365 연동 최적화. 기업 정책 관리 지원.",
    officialUrl: "https://www.microsoft.com/edge",
  },

  // ── 승인 SW: 개발도구 ─────────────────────────────────────────────────────
  {
    id: "sw_ok_vscode", name: "Visual Studio Code", vendor: "Microsoft",
    category: "개발도구", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 오픈소스 코드 편집기. MIT 라이선스. 기업 환경 무제한 사용 가능. 풍부한 확장 기능.",
    officialUrl: "https://code.visualstudio.com",
  },
  {
    id: "sw_ok_git", name: "Git", vendor: "The Git Development Community",
    category: "개발도구", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "분산 버전 관리 시스템. GPL v2 라이선스. 기업 무제한 사용 가능. 소스코드 형상관리 필수 도구.",
    officialUrl: "https://git-scm.com",
  },
  {
    id: "sw_ok_notepadpp", name: "Notepad++", vendor: "Don Ho",
    category: "개발도구", status: "approved",
    alternatives: ["Visual Studio Code"],
    mandatory: false,
    description: "경량 텍스트/코드 편집기. GPL v3 라이선스. 기업 무제한 사용 가능.",
    officialUrl: "https://notepad-plus-plus.org",
  },
  {
    id: "sw_ok_python", name: "Python", vendor: "Python Software Foundation",
    category: "개발도구", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "범용 프로그래밍 언어. PSF 라이선스로 기업 무제한 사용 가능. 데이터 분석/자동화 업무에 활용.",
    officialUrl: "https://www.python.org",
  },
  {
    id: "sw_ok_nodejs", name: "Node.js", vendor: "OpenJS Foundation",
    category: "개발도구", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "JavaScript 런타임. MIT 라이선스. 기업 무제한 사용 가능.",
    officialUrl: "https://nodejs.org",
  },
  {
    id: "sw_ok_dbeaver", name: "DBeaver Community", vendor: "DBeaver Corp.",
    category: "개발도구", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "오픈소스 데이터베이스 관리 도구. Apache 2.0 라이선스. MySQL, PostgreSQL, Oracle 등 지원.",
    officialUrl: "https://dbeaver.io",
  },

  // ── 승인 SW: 유틸리티 ────────────────────────────────────────────────────
  {
    id: "sw_ok_7zip", name: "7-Zip", vendor: "Igor Pavlov",
    category: "유틸리티", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 오픈소스 압축 프로그램. LGPL 라이선스. 기업 무제한 사용 가능. 높은 압축률, 암호화 지원.",
    officialUrl: "https://www.7-zip.org",
  },
  {
    id: "sw_ok_bandizip", name: "Bandizip (반디집)", vendor: "Bandisoft",
    category: "유틸리티", status: "approved",
    alternatives: ["7-Zip"],
    mandatory: false,
    description: "국산 무료 압축 프로그램. 개인/기업 모두 무료 사용 가능. 한글 파일명 완벽 지원.",
    officialUrl: "https://www.bandisoft.com/bandizip",
  },

  // ── 승인 SW: 미디어 ───────────────────────────────────────────────────────
  {
    id: "sw_ok_vlc", name: "VLC Media Player", vendor: "VideoLAN",
    category: "미디어", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 오픈소스 미디어 플레이어. GPL v2 라이선스. 기업 무제한 사용 가능. 모든 미디어 형식 지원.",
    officialUrl: "https://www.videolan.org/vlc",
  },
  {
    id: "sw_ok_acroreader", name: "Adobe Acrobat Reader", vendor: "Adobe Inc.",
    category: "뷰어", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 PDF 뷰어. Adobe 무료 사용 정책으로 기업 무제한 사용 가능. PDF 열람/출력/서명 지원.",
    officialUrl: "https://get.adobe.com/reader",
  },

  // ── 승인 SW: 디자인 ───────────────────────────────────────────────────────
  {
    id: "sw_ok_gimp", name: "GIMP", vendor: "The GIMP Team",
    category: "디자인", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 오픈소스 이미지 편집 프로그램. GPL v3 라이선스. 기업 무제한 사용 가능. Photoshop 대안.",
    officialUrl: "https://www.gimp.org",
  },
  {
    id: "sw_ok_inkscape", name: "Inkscape", vendor: "Inkscape Project",
    category: "디자인", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 오픈소스 벡터 그래픽 편집기. GPL 라이선스. Illustrator 대안. SVG 편집 전문.",
    officialUrl: "https://inkscape.org",
  },

  // ── 승인 SW: 네트워크 ─────────────────────────────────────────────────────
  {
    id: "sw_ok_winscp", name: "WinSCP", vendor: "Martin Prikryl",
    category: "네트워크/보안", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 SFTP/FTP 클라이언트. GPL 라이선스. 서버 파일 전송에 사용.",
    officialUrl: "https://winscp.net",
  },
  {
    id: "sw_ok_putty", name: "PuTTY", vendor: "Simon Tatham",
    category: "네트워크/보안", status: "approved",
    alternatives: [],
    mandatory: false,
    description: "무료 SSH/텔넷 클라이언트. MIT 라이선스. 서버 원격 터미널 접속에 사용.",
    officialUrl: "https://www.putty.org",
  },

  // ── 조건부 SW ─────────────────────────────────────────────────────────────
  {
    id: "sw_cond_teams", name: "Microsoft Teams", vendor: "Microsoft",
    category: "협업", status: "conditional",
    alternatives: [],
    mandatory: false,
    description: "사내 공식 협업 도구. Microsoft 365 라이선스 포함 시 사용 가능. 라이선스 담당자에게 확인 후 사용.",
    officialUrl: "https://www.microsoft.com/microsoft-teams",
  },
  {
    id: "sw_cond_zoom", name: "Zoom", vendor: "Zoom Video Communications",
    category: "협업", status: "conditional",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "화상회의 솔루션. 무료 버전 40분 제한. 기업용 라이선스 필요 시 IT 부서에 신청. 외부 거래처와의 회의 시 조건부 허용.",
    officialUrl: "https://zoom.us",
  },
  {
    id: "sw_cond_slack", name: "Slack", vendor: "Salesforce",
    category: "협업", status: "conditional",
    alternatives: ["Microsoft Teams"],
    mandatory: false,
    description: "팀 메신저 플랫폼. 무료 버전 90일 메시지 제한. 기업 계약 여부 IT 부서 확인 필요.",
    officialUrl: "https://slack.com",
  },
  {
    id: "sw_cond_postman", name: "Postman", vendor: "Postman Inc.",
    category: "개발도구", status: "conditional",
    alternatives: [],
    mandatory: false,
    description: "API 테스트 및 개발 도구. 개인 계정 무료 사용 가능. 팀 기능은 유료. IT 부서 승인 후 사용.",
    officialUrl: "https://www.postman.com",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 자료실 데이터 (portal:resources)
// ─────────────────────────────────────────────────────────────────────────────
const RESOURCES = [
  {
    id: "r_libreoffice", title: "LibreOffice 7.x — 오픈소스 오피스 스위트",
    category: "오피스",
    fileUrl: "https://www.libreoffice.org/download/download-libreoffice/",
    fileType: "LINK", fileSize: "~350MB",
    description: "Word/Excel/PowerPoint 대체 무료 오피스 프로그램. Writer(문서), Calc(스프레드시트), Impress(프레젠테이션) 포함. MS Office 파일 형식(.docx/.xlsx/.pptx) 완벽 호환. MPL 2.0 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 0, visible: true, createdAt: now,
  },
  {
    id: "r_vscode", title: "Visual Studio Code — 코드 편집기",
    category: "개발도구",
    fileUrl: "https://code.visualstudio.com/download",
    fileType: "LINK", fileSize: "~100MB",
    description: "Microsoft에서 만든 무료 코드 편집기. Python, JavaScript, TypeScript, Java 등 모든 언어 지원. 풍부한 확장 플러그인 생태계. Git 연동 내장. MIT 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 1, visible: true, createdAt: now,
  },
  {
    id: "r_git", title: "Git — 버전 관리 시스템",
    category: "개발도구",
    fileUrl: "https://git-scm.com/download/win",
    fileType: "LINK", fileSize: "~50MB",
    description: "분산 버전 관리 시스템. 소스코드 변경 이력 관리, 협업 개발의 필수 도구. GitHub/GitLab 연동. GPL v2 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 2, visible: true, createdAt: now,
  },
  {
    id: "r_7zip", title: "7-Zip — 오픈소스 압축 프로그램",
    category: "유틸리티",
    fileUrl: "https://www.7-zip.org/download.html",
    fileType: "LINK", fileSize: "~1.5MB",
    description: "높은 압축률의 무료 오픈소스 압축 프로그램. zip/7z/rar 등 모든 형식 지원. AES-256 암호화 지원. LGPL 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 3, visible: true, createdAt: now,
  },
  {
    id: "r_bandizip", title: "Bandizip (반디집) — 국산 무료 압축 프로그램",
    category: "유틸리티",
    fileUrl: "https://www.bandisoft.com/bandizip/",
    fileType: "LINK", fileSize: "~20MB",
    description: "국내산 무료 압축/해제 프로그램. 한글 파일명 완벽 지원. zip/7z/rar/tar 등 지원. 개인 및 기업 모두 무료 사용 가능. 광고 없는 깔끔한 UI.",
    updatedAt: "2024-01-01", order: 4, visible: true, createdAt: now,
  },
  {
    id: "r_vlc", title: "VLC Media Player — 만능 미디어 플레이어",
    category: "미디어",
    fileUrl: "https://www.videolan.org/vlc/",
    fileType: "LINK", fileSize: "~40MB",
    description: "모든 미디어 파일 형식을 재생하는 오픈소스 플레이어. MP4/AVI/MKV/MOV 등 무제한 지원. 코덱 별도 설치 불필요. GPL v2 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 5, visible: true, createdAt: now,
  },
  {
    id: "r_gimp", title: "GIMP — 오픈소스 이미지 편집기",
    category: "디자인",
    fileUrl: "https://www.gimp.org/downloads/",
    fileType: "LINK", fileSize: "~250MB",
    description: "Photoshop 대체 무료 이미지 편집 프로그램. 레이어, 필터, 마스크 등 전문 기능 지원. GPL v3 라이선스로 기업 무제한 사용 가능. Windows/Mac/Linux 지원.",
    updatedAt: "2024-01-01", order: 6, visible: true, createdAt: now,
  },
  {
    id: "r_inkscape", title: "Inkscape — 오픈소스 벡터 그래픽 편집기",
    category: "디자인",
    fileUrl: "https://inkscape.org/release/",
    fileType: "LINK", fileSize: "~100MB",
    description: "Adobe Illustrator 대체 무료 벡터 그래픽 편집기. SVG 형식 기반. 로고, 아이콘, 인쇄물 디자인에 활용. GPL 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 7, visible: true, createdAt: now,
  },
  {
    id: "r_notepadpp", title: "Notepad++ — 경량 텍스트/코드 편집기",
    category: "개발도구",
    fileUrl: "https://notepad-plus-plus.org/downloads/",
    fileType: "LINK", fileSize: "~4MB",
    description: "빠르고 가벼운 텍스트 편집기. 다중 탭, 문법 강조, 매크로 지원. 80개 이상 언어 지원. GPL v3 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 8, visible: true, createdAt: now,
  },
  {
    id: "r_python", title: "Python 3.x — 프로그래밍 언어",
    category: "개발도구",
    fileUrl: "https://www.python.org/downloads/",
    fileType: "LINK", fileSize: "~25MB",
    description: "범용 프로그래밍 언어. 데이터 분석, 업무 자동화, 웹 개발 등 활용. PSF 라이선스로 기업 무제한 사용 가능. 초보자 친화적인 문법.",
    updatedAt: "2024-01-01", order: 9, visible: true, createdAt: now,
  },
  {
    id: "r_winscp", title: "WinSCP — SFTP/FTP 파일 전송 클라이언트",
    category: "네트워크",
    fileUrl: "https://winscp.net/eng/download.php",
    fileType: "LINK", fileSize: "~10MB",
    description: "서버와 안전하게 파일을 주고받는 SFTP/FTP 클라이언트. 드래그앤드롭 파일 전송 지원. GPL 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 10, visible: true, createdAt: now,
  },
  {
    id: "r_putty", title: "PuTTY — SSH/텔넷 터미널 클라이언트",
    category: "네트워크",
    fileUrl: "https://www.putty.org/",
    fileType: "LINK", fileSize: "~3MB",
    description: "서버 원격 접속용 SSH/텔넷 클라이언트. 가볍고 안정적인 오픈소스 도구. MIT 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 11, visible: true, createdAt: now,
  },
  {
    id: "r_chrome", title: "Google Chrome — 기업 표준 웹 브라우저",
    category: "브라우저",
    fileUrl: "https://www.google.com/chrome/",
    fileType: "LINK", fileSize: "~80MB",
    description: "기업 표준 브라우저. Google 계정 연동, 확장 프로그램, 개발자 도구 지원. 무료 사용 가능. 그룹 정책을 통한 기업 관리 지원.",
    updatedAt: "2024-01-01", order: 12, visible: true, createdAt: now,
  },
  {
    id: "r_dbeaver", title: "DBeaver Community — 오픈소스 DB 관리 도구",
    category: "개발도구",
    fileUrl: "https://dbeaver.io/download/",
    fileType: "LINK", fileSize: "~100MB",
    description: "MySQL, PostgreSQL, Oracle, MSSQL 등 모든 DB를 하나로 관리. 쿼리 편집기, ER 다이어그램, 데이터 내보내기 지원. Apache 2.0 라이선스로 기업 무제한 사용 가능.",
    updatedAt: "2024-01-01", order: 13, visible: true, createdAt: now,
  },
  {
    id: "r_acroreader", title: "Adobe Acrobat Reader DC — 무료 PDF 뷰어",
    category: "문서뷰어",
    fileUrl: "https://get.adobe.com/reader/",
    fileType: "LINK", fileSize: "~250MB",
    description: "PDF 열람/출력/주석/전자서명을 지원하는 Adobe 공식 무료 뷰어. 기업 환경 무제한 무료 사용 가능.",
    updatedAt: "2024-01-01", order: 14, visible: true, createdAt: now,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 교육센터 데이터 (portal:courses) — 필수교육 4개
// ─────────────────────────────────────────────────────────────────────────────
const COURSES = [
  {
    id: "c_license_personal_vs_corp",
    title: "개인용 vs 기업용 라이선스 — 무엇이 다른가?",
    description: `소프트웨어를 '무료'로 다운로드해도 기업에서 사용하면 불법이 될 수 있습니다.

■ 핵심 개념
- 프리웨어(Freeware): 개인 사용 무료 → 기업 사용 시 유료 or 금지
- 오픈소스(Open Source): 소스 공개 → 라이선스 종류에 따라 기업 무료 사용 가능
- 상용 소프트웨어: 기업 사용 시 반드시 기업용 라이선스 구매 필요

■ 대표 사례
- 팀뷰어(TeamViewer): 개인 무료, 기업 유료 → 기업에서 무단 사용 시 청구서 발송
- WinRAR: 기술적으로 무제한 사용 가능하나 기업 사용 시 라이선스 구매 필요
- Adobe Acrobat Reader: 뷰어는 기업도 무료, 편집 기능은 유료

■ 기업에서 안전하게 사용 가능한 SW
라이선스에 "Commercial use permitted" 또는 MIT/Apache 2.0/GPL 등 오픈소스 라이선스가 있는 경우 기업 무료 사용 가능.`,
    deadline: "",
    duration: "15분",
    courseUrl: "https://www.oss.kr/oss_license",
    category: "required",
    thumbnailUrl: "",
    order: 0, visible: true, createdAt: now,
  },
  {
    id: "c_opensource_intro",
    title: "오픈소스 라이선스 완전 정복",
    description: `오픈소스 소프트웨어는 '공짜'이지만, 라이선스 조건을 지켜야 합니다.

■ 주요 오픈소스 라이선스 종류
- MIT License: 가장 자유로운 라이선스. 기업 사용·수정·배포 모두 자유. 저작권 표시만 유지.
- Apache 2.0: MIT와 유사. 특허 보호 조항 포함. 기업 환경에서 가장 선호.
- GPL v2/v3: 소스코드 공개 의무. 수정 배포 시 동일 라이선스 적용(카피레프트).
- LGPL: 라이브러리 사용 시 소스 공개 의무 완화. 링크 사용은 자유.
- BSD: MIT와 유사. 광고 조항 有無에 따라 2-clause/3-clause 구분.

■ 기업에서 주의할 라이선스
- GPL: 내부 업무 도구로 사용 시 대부분 안전. 제품에 포함 시 법무팀 검토 필요.
- AGPL: 웹서비스에 사용해도 소스 공개 의무 → 사용 전 반드시 검토.

■ 라이선스 확인 방법
소프트웨어 공식 사이트 또는 OSS Notice / LICENSE 파일 확인.
공개SW포털(www.oss.kr)에서 라이선스별 의무사항 확인 가능.`,
    deadline: "",
    duration: "20분",
    courseUrl: "https://www.oss.kr/oss_intro",
    category: "required",
    thumbnailUrl: "",
    order: 1, visible: true, createdAt: now,
  },
  {
    id: "c_copyright_policy",
    title: "소프트웨어 저작권과 라이선스 규정",
    description: `소프트웨어는 저작권법의 보호를 받는 저작물입니다. 기업에서 지켜야 할 핵심 규정을 확인하세요.

■ 저작권법 주요 조항 (대한민국)
- 제136조: 저작재산권 침해 → 5년 이하 징역 또는 5천만원 이하 벌금
- 제125조: 손해배상 — 실제 손해액의 최대 3배 징벌적 손해배상 가능
- 업무상 저작물 무단 사용 시 법인도 처벌 대상 (양벌규정)

■ 기업에서 반드시 지켜야 할 사항
1. 정품 소프트웨어만 사용 (구매 영수증/라이선스 키 보관)
2. 사용 중인 SW 라이선스 수량 관리 (사용자 수 초과 금지)
3. 퇴직자 라이선스 회수 및 재배정 절차 준수
4. 오픈소스 사용 시 라이선스 의무 준수
5. 불법 복제본, 크랙 버전 사용 절대 금지

■ 내부 감사 시 확인 사항
- 설치 소프트웨어 목록 vs 보유 라이선스 수량 일치 여부
- 라이선스 계약서 및 구매 증빙 서류 보관 여부`,
    deadline: "",
    duration: "20분",
    courseUrl: "https://www.copyright.or.kr",
    category: "required",
    thumbnailUrl: "",
    order: 2, visible: true, createdAt: now,
  },
  {
    id: "c_illegal_sw_risks",
    title: "불법 소프트웨어 사용의 법적 리스크 — 실사례",
    description: `기업에서 불법 소프트웨어를 사용하면 어떤 일이 벌어질까요? 실제 적발 사례와 처벌 수위를 확인하세요.

■ 국내 적발 사례
- 2022년 국내 중견기업 A사: Microsoft Office 미라이선스 사용 적발 → 합의금 수억원 지급
- 2021년 IT기업 B사: Adobe Creative Cloud 무단 사용 → 민사소송 제기, 3배 손해배상 판결
- 2019년 제조업체 C사: AutoCAD 크랙 버전 수십 카피 사용 → 형사 고발 후 벌금 1억원

■ BSA(소프트웨어 얼라이언스) 적발 방식
- 직원 제보(내부고발) → 가장 많은 적발 경로 (전체의 약 65%)
- 불만을 품은 퇴직자 신고
- 정기 감사 및 자진 신고 프로그램

■ 처벌 수위
형사: 5년 이하 징역 / 5천만원 이하 벌금 (개인 및 법인)
민사: 실제 손해액 + 최대 3배 징벌적 손해배상
행정: 공공입찰 제한, 기업 이미지 손상

■ 예방 방법
✓ 정기적 SW 자산 감사 실시 (연 1회 이상)
✓ IT 포털을 통한 승인된 SW만 설치
✓ 불법 SW 발견 즉시 IT 부서 신고
✓ 라이선스 관리 시스템 구축 및 유지`,
    deadline: "",
    duration: "25분",
    courseUrl: "https://www.bsa.org/ko-kr",
    category: "required",
    thumbnailUrl: "",
    order: 3, visible: true, createdAt: now,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Upstash에 일괄 저장
// ─────────────────────────────────────────────────────────────────────────────
async function pushToUpstash() {
  console.log(`[seed-portal] SW 검색: ${SW_ITEMS.length}개`);
  console.log(`[seed-portal] 자료실:  ${RESOURCES.length}개`);
  console.log(`[seed-portal] 교육센터: ${COURSES.length}개`);

  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify([
      ["SET", "portal:swdb",      JSON.stringify(SW_ITEMS)],
      ["SET", "portal:resources", JSON.stringify(RESOURCES)],
      ["SET", "portal:courses",   JSON.stringify(COURSES)],
    ]),
  });

  if (!res.ok) throw new Error(`Upstash API ${res.status}: ${await res.text()}`);
  const result = await res.json();
  console.log("[seed-portal] Upstash 저장 결과:", result);
}

async function main() {
  console.log(`[seed-portal] 시작: ${new Date().toISOString()}`);
  await pushToUpstash();
  console.log("[seed-portal] 완료 ✅");
}

main().catch(e => {
  console.error("[seed-portal] 오류:", e.message);
  process.exit(1);
});
