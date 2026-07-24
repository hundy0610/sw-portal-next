// ─────────────────────────────────────────────────────────────────────────────
// Notion 백업 레지스트리 (4.0verMACBOOK)
//
// 맥북 Postgres 가 메인이고, 5분마다 dirty 행만 Notion 으로 단방향 백업한다.
// scripts/backup-to-notion.ts(맥북 launchd)가 이 레지스트리를 참조해 엔티티별로
// Notion 페이지를 생성/수정/아카이브한다.
//
//   - HW 는 typed hw 테이블을 쓰므로 전용 빌더(buildHwBackupProperties)를 둔다.
//   - 그 외 엔티티는 public.entity_store(제네릭 미러)에 저장되며, entityRegistry 에
//     엔티티키 → { databaseId, buildProperties } 를 등록하면 백업 대상이 된다.
//     (Batch B/C 에서 엔티티를 미러로 전환할 때 여기에 항목을 추가한다.)
// ─────────────────────────────────────────────────────────────────────────────

type Props = Record<string, unknown>;

// ── Notion 프로퍼티 빌더 헬퍼 ───────────────────────────────────────────────
export const P = {
  title(v: unknown): Props {
    return { title: [{ text: { content: String(v ?? "") } }] };
  },
  text(v: unknown): Props {
    // Notion rich_text 단일 블록 텍스트 한도(2000자) 회피용 청크 분할
    const s = String(v ?? "");
    if (s.length <= 1900) return { rich_text: s ? [{ text: { content: s } }] : [] };
    const chunks: string[] = [];
    for (let i = 0; i < s.length; i += 1900) chunks.push(s.slice(i, i + 1900));
    return { rich_text: chunks.map(c => ({ text: { content: c } })) };
  },
  select(v: unknown): Props {
    const s = String(v ?? "");
    return s ? { select: { name: s } } : { select: null };
  },
  status(v: unknown): Props {
    const s = String(v ?? "");
    return s ? { status: { name: s } } : { status: null };
  },
  date(v: unknown): Props {
    const s = String(v ?? "");
    return s ? { date: { start: s } } : { date: null };
  },
  dateRange(start: unknown, end: unknown): Props {
    const s = String(start ?? "");
    const e = String(end ?? "");
    if (!s) return { date: null };
    return { date: { start: s, end: e || null } };
  },
  number(v: unknown): Props {
    const n = typeof v === "number" ? v : Number(v);
    return { number: Number.isFinite(n) ? n : null };
  },
  email(v: unknown): Props {
    const s = String(v ?? "");
    return s ? { email: s } : { email: null };
  },
  checkbox(v: unknown): Props {
    return { checkbox: !!v };
  },
  multiSelect(v: unknown): Props {
    const arr = Array.isArray(v) ? v.map(String).filter(Boolean) : [];
    return { multi_select: arr.map(name => ({ name })) };
  },
  people(id: unknown): Props {
    const s = String(id ?? "");
    return s ? { people: [{ object: "user", id: s }] } : { people: [] };
  },
} as const;

// ── HW 전용(typed hw 테이블) ────────────────────────────────────────────────
export const HW_DB_ID = "29967f4b-fdac-8086-b468-ef3545b3e471";

/**
 * HW 레코드(hw 테이블 행) → Notion 프로퍼티(생성/수정 공용).
 * 편집 가능한 속성만 기록한다(잔존가치/중복 등 계산·관리 필드는 제외해 API 오류 방지).
 */
export function buildHwBackupProperties(r: Record<string, unknown>): Props {
  const props: Props = {
    "사용자": P.title(r.user),
    "자산번호": P.text(r.assetNo),
    "모델명": P.text(r.model),
    "시리얼 넘버": P.text(r.serial),
    "제조사": P.select(r.maker),
    "CPU": P.text(r.cpu),
    "RAM": P.text(r.ram),
    "법인명": P.select(r.company),
    "부서": P.text(r.dept),
    "위치": P.text(r.location),
    "사용/재고/폐기/기타": P.select(r.status),
    "반납예정일": P.date(r.returnDue),
    "반납일자": P.date(r.returnDate),
    "구매일자": P.date(r.purchaseDate),
    "사용일자": P.date(r.useDate),
    "기타": P.text(r.note),
    "결재문서번호": P.text(r.docNo),
    "MAC": P.text(r.mac),
    "이메일": P.email(r.email),
    "실사확인": P.checkbox(r.verified),
    "마지막수정자": P.text(r.lastModifiedBy),
    "마지막수정일시": P.text(r.lastModifiedAt),
    "변경이력": P.text(r.changeLog),
  };
  if (typeof r.price === "number" && r.price > 0) props["단가"] = P.number(r.price);
  return props;
}

// ── 제네릭 미러 엔티티 레지스트리 ───────────────────────────────────────────
export interface NotionFileRef { url: string; name: string; }

export interface NotionFileField {
  /** Notion files 프로퍼티명 (예: "계약서", "설치프로그램"). */
  prop: string;
  /**
   * 레코드에서 현재 첨부파일(Blob 공개 URL)과 표시명을 뽑는다. 없으면 null.
   * 여러 파일을 담는 필드는 배열을 반환한다(예: hw-repair 의 수리영수증).
   */
  get: (data: Record<string, unknown>) => NotionFileRef | NotionFileRef[] | null;
}

export interface NotionBackupEntry {
  /** 백업 대상 Notion 데이터베이스 id (env 우선, 없으면 상수). */
  databaseId: string | undefined;
  /**
   * data_source_id 로만 관리되는 DB(예: 회의실 대여신청)는 이 값을 설정한다.
   * 신규 페이지 생성 시 parent 를 { data_source_id } 로 사용한다(신 Notion API).
   * databaseId 또는 dataSourceId 중 하나는 반드시 있어야 백업 대상이 된다.
   */
  dataSourceId?: string | undefined;
  /** 저장 레코드(data jsonb) → Notion 프로퍼티(생성/수정 공용). */
  buildProperties: (data: Record<string, unknown>) => Props;
  /**
   * 첨부파일 필드(선택). Blob URL 이 바뀐 경우에만 백업 러너가 Notion file_uploads 로
   * 재업로드한다(이미 올린 파일은 data.__syncedFiles 로 추적해 재업로드하지 않음).
   */
  files?: NotionFileField[];
}

/**
 * 엔티티키 → 백업 설정. Batch B/C 에서 각 엔티티를 미러(entity_store)로 전환할 때
 * 여기에 항목을 추가하면 backup-to-notion 러너가 자동으로 백업한다.
 */
export const entityRegistry: Record<string, NotionBackupEntry> = {
  // 회의실 장비 — "상태"는 Notion formula 이므로 기록하지 않는다.
  "meeting-equipment": {
    databaseId: process.env.NOTION_DB_MEETING_EQUIPMENT,
    buildProperties: (d) => {
      const props: Props = {
        "장비명": P.title(d.name),
        "부서": P.text(d.department),
        "현재사용자": P.text(d.currentUser),
        "비고": P.text(d.note),
        "대여중": P.checkbox(d.inUse),
        "법인": P.select(d.company),
        "사용자 이메일": P.email(d.userEmail),
        "대여시작일": P.date(d.startDate),
        "반납예정일": P.date(d.returnDue),
      };
      return props;
    },
  },

  // 교체/반납 트래커 — 담당자는 Notion people(assigneeId 사용). assignee(이름)/notionUrl 은 백업 제외.
  "exchange-return": {
    databaseId: process.env.NOTION_DB_EXCHANGE_RETURN,
    buildProperties: (d) => ({
      "자산번호": P.title(d.assetId),
      "유형": P.select(d.type),
      "교체 자산번호": P.text(d.newAssetId),
      "법인": P.select(d.company),
      "부서": P.text(d.department),
      "사용자": P.text(d.user),
      "현재단계": P.select(d.stage),
      "신청일": P.date(d.requestedAt),
      "사용일자": P.date(d.useDate),
      "반납예정일": P.date(d.returnDue),
      "완료일": P.date(d.completedAt),
      "신청사유": P.text(d.reason),
      "담당자": P.people(d.assigneeId),
      "비고": P.text(d.note),
      "배송지": P.select(d.address),
      "기안자이메일": P.email(d.requesterEmail),
      "자동동기화": P.checkbox(d.autoSynced),
      "케이스종료": P.checkbox(d.isClosed),
      "마지막수정자": P.text(d.lastModifiedBy),
    }),
  },

  // 렌탈 HW — "상태"는 Notion formula 이므로 기록 제외.
  "rental-hw": {
    databaseId: process.env.NOTION_DB_RENTAL_HW,
    buildProperties: (d) => ({
      "실사용자 / 지급사유": P.title(d.userAndReason),
      "요청인": P.text(d.requester),
      "부서": P.text(d.dept),
      "출고자산번호": P.text(d.assetNo),
      "출고자산번호 (기존)": P.text(d.assetNoOld),
      "인증 DLP 계정": P.text(d.dlpAccount),
      "재고": P.checkbox(d.inStock),
      "요청법인": P.select(d.company),
      "사용시작일": P.date(d.startDate),
      "반납예정일": P.date(d.returnDue),
    }),
  },

  // PC/OA 유지보수 계약 — 계약서(PDF)는 Blob→Notion 재업로드(files). status 는 계산값이라 제외.
  "contracts": {
    databaseId: process.env.NOTION_DB_CONTRACTS,
    buildProperties: (d) => ({
      "법인명": P.title(d.company),
      "담당자": P.text(d.contactName),
      "이메일": P.email(d.contactEmail),
      "계약시작일": P.date(d.startDate),
      "계약종료일": P.date(d.endDate),
      "PC수량": P.number(d.quantity),
      "단가": P.number(d.unitPrice),
      "메모": P.text(d.notes),
      "진행단계": P.select(d.stage),
    }),
    files: [
      {
        prop: "계약서",
        get: (d) => (d.pdfUrl ? { url: String(d.pdfUrl), name: String(d.pdfName || "계약서") } : null),
      },
    ],
  },

  // PC 자산실사(온라인 실사) — 설치프로그램(xlsx)은 Blob→Notion 재업로드(files).
  "pc-scan": {
    databaseId: process.env.NOTION_DB_PC_SCAN,
    buildProperties: buildPcScanProperties,
    files: [
      {
        prop: "설치프로그램",
        get: (d) => (d.programFileUrl ? { url: String(d.programFileUrl), name: String(d.programFileName || "programs.xlsx") } : null),
      },
    ],
  },

  // PC 신규 등록(자산 실사 방식) — 별도 DB, pc-scan 과 동일한 스키마.
  "pc-register": {
    databaseId: process.env.NOTION_DB_PC_REGISTER,
    buildProperties: buildPcScanProperties,
    files: [
      {
        prop: "설치프로그램",
        get: (d) => (d.programFileUrl ? { url: String(d.programFileUrl), name: String(d.programFileName || "programs.xlsx") } : null),
      },
    ],
  },

  // SW 통합 DB — 증서/기안문서(PDF 등)는 Blob→Notion 재업로드(files).
  // 사용횟수/연 비용은 formula·계산값이라 기록 제외.
  "sw": {
    databaseId: process.env.NOTION_DB_SW_UNIFIED,
    buildProperties: (d) => {
      const props: Props = {
        "사용자": P.title(d.user),
        "SW대분류": P.select(d.swCategory),
        "SW소분류": P.text(d.swDetail),
        "version": P.multiSelect(d.version),
        "사용/재고/만료/갱신필요/신규등록": P.select(d.status),
        "법인명": P.select(d.company),
        "영구 / 구독": P.select(d.licenseType),
        "부서": P.text(d.department),
        "사용일자": P.date(d.usageDate),
        "갱신필요일": P.date(d.renewalDate),
        "구매일자": P.date(d.purchaseDate),
        "회수일자": P.date(d.returnDate),
        "출고진행상황": P.status(d.shipStatus),
        "계정유형": P.select(d.accountType),
        "갱신주기": P.select(d.renewalCycle),
        "인증키 / 인증계정": P.text(d.licenseKey),
        "구매처": P.text(d.vendor),
        "SW사용직군": P.select(d.workType),
        "결재방식": P.select(d.billingType),
        "마지막수정자": P.text(d.lastModifiedBy),
        "마지막수정일시": P.text(d.lastModifiedAt),
      };
      if (typeof d.monthlyKrw === "number" && d.monthlyKrw > 0) props["월 비용 (KRW)"] = P.number(d.monthlyKrw);
      if (typeof d.monthlyUsd === "number" && d.monthlyUsd > 0) props["월 비용 (USD)"] = P.number(d.monthlyUsd);
      return props;
    },
    files: [
      { prop: "증서",     get: (d) => (d.certificate   ? { url: String(d.certificate),   name: fileNameFromUrl(String(d.certificate), "증서") } : null) },
      { prop: "기안문서", get: (d) => (d.draftDocument ? { url: String(d.draftDocument), name: fileNameFromUrl(String(d.draftDocument), "기안문서") } : null) },
    ],
  },

  // HW 외부 수리 — 4개 파일 필드(각 다중 첨부). 담당자는 people(assigneeId). notionUrl/lastEditedAt 제외.
  "hw-repair": {
    databaseId: process.env.NOTION_DB_HW_REPAIR,
    buildProperties: (d) => ({
      "자산번호": P.title(d.assetId),
      "법인": P.select(d.company),
      "부서": P.text(d.department),
      "사용자": P.text(d.user),
      "수리업체": P.select(d.vendor),
      "현재단계": P.select(d.stage),
      "접수일": P.date(d.receivedAt),
      "실제완료일": P.date(d.completedAt),
      "과실여부": P.select(d.faultType),
      "담당자": P.people(d.assigneeId),
      "수리내용": P.text(d.note),
      "수리비용": P.number(d.repairCost),
      "대분류": P.select(d.assetStatus),
      "배송지": P.select(d.address),
      "기안자이메일": P.email(d.requesterEmail),
      "케이스종료": P.checkbox(d.isClosed),
    }),
    files: [
      { prop: "수리영수증",     get: (d) => filesRef(d.receiptUrl, "수리영수증") },
      { prop: "진행동의서",     get: (d) => filesRef(d.consentUrl, "진행동의서") },
      { prop: "세금계산서결재", get: (d) => filesRef(d.taxInvoiceUrl, "세금계산서결재") },
      { prop: "내부결재내용",   get: (d) => filesRef(d.approvalUrl, "내부결재내용") },
    ],
  },

  // 헬프데스크 문의 — 문의 상세 본문은 미러(content)에만 보존(백업은 제목·메타). "상태"는 status 타입.
  "helpdesk": {
    databaseId: process.env.NOTION_DB_HELPDESK || process.env.NOTION_DB_TICKETS,
    buildProperties: (d) => {
      const props: Props = {
        "문의내용": P.title(d.title),
        "문의유형": P.select(d.inquiryType),
        "법인": P.select(d.company),
        "부서": P.text(d.department),
        "문의자": P.text(d.requester),
        "문의자 이메일": P.email(d.requesterEmail),
        "자산번호": P.text(d.assetNo),
        "긴급도": P.select(d.urgency),
        "상태": P.status(d.status),
        "담당자": P.people(d.assigneeId),
        "조치 내용": P.text(d.actionNote),
        "조치분류": P.multiSelect(d.actionCategory),
        "조치방법": P.select(d.actionMethod),
        "평가메일발송": P.checkbox(d.feedbackEmailSent),
      };
      // 만족도 평가는 제출된 경우에만 기록(미평가 티켓의 값 덮어쓰기 방지).
      if (typeof d.satisfaction === "number" && d.satisfaction > 0) {
        props["만족도"] = P.number(d.satisfaction);
        props["피드백코멘트"] = P.text(d.feedbackComment);
      }
      return props;
    },
  },

  // 수리 접수 — "상태"는 status 타입. Ticket(unique_id)/createdAt(created_time)은 Notion 자동값이라 제외.
  "repair": {
    databaseId: process.env.NOTION_DB_REPAIR_TICKETS,
    buildProperties: (d) => ({
      "고장증상": P.title(d.title),
      "고장 내역": P.multiSelect(d.faultTypes),
      "상태": P.status(d.status),
      "긴급도": P.select(d.priority),
      "법인": P.select(d.company),
      "부서": P.text(d.department),
      "실제 근무 위치": P.text(d.location),
      "건물명": P.select(d.building),
      "층수": P.text(d.floor),
      "자산번호": P.text(d.assetId),
      "세부내역": P.text(d.detail),
      "문의자": P.text(d.requester),
      "담당자": P.people(d.assigneeId),
      "수리 일정": P.date(d.repairDate),
      "조치내용": P.text(d.actionNote),
      "수리 진행 동의서": P.checkbox(d.consentGiven),
    }),
  },

  // 계정/비밀번호 보관함 — PW 는 암호화된 문자열을 그대로 기록(복호화하지 않음).
  "credentials": {
    databaseId: process.env.NOTION_PAGE_CREDENTIALS,
    buildProperties: (d) => ({
      "이름": P.title(d.swName),
      "ID": P.text(d.accountId),
      "PW": P.text(d.password),
      "URL": d.siteUrl ? { url: String(d.siteUrl) } : { url: null },
      "유형": P.text(d.memo),
    }),
  },

  // SW 수요조사 설문 — 제출일시는 명시 date 로 기록.
  "survey-demand": {
    databaseId: process.env.NOTION_DB_SURVEY_DEMAND,
    buildProperties: (d) => ({
      "성함": P.title(d.name),
      "소속법인": P.text(d.company),
      "부서명": P.text(d.department),
      "이메일": P.email(d.email),
      "사용목적": P.multiSelect(d.purpose),
      "주요언어": P.multiSelect(d.language),
      "사용주기": P.text(d.frequency),
      "특이사항": P.text(d.note),
      "제출일시": P.date(d.submittedAt),
    }),
  },

  // 회의실 무선 장비 대여신청 — data_source_id 로만 관리. createdAt(created_time)은 Notion 자동값이라 제외.
  "meeting-rental": {
    databaseId: undefined,
    dataSourceId: process.env.MEETING_RENTAL_DATA_SOURCE_ID,
    buildProperties: (d) => ({
      "신청자": P.title(d.requester),
      "법인명": P.select(d.company),
      "부서": P.text(d.department),
      "신청자 이메일": P.email(d.email),
      "신청기간": P.dateRange(d.startAt, d.endAt),
      "상태": P.status(d.status),
      "담당자": P.people(d.assigneeId),
    }),
  },
};

// 다중 파일 필드(string[] Blob URL) → NotionFileRef[]
function filesRef(v: unknown, label: string): NotionFileRef[] | null {
  const arr = Array.isArray(v) ? v.filter(u => typeof u === "string" && u) as string[] : [];
  if (arr.length === 0) return null;
  return arr.map((url, i) => ({ url, name: `${label}_${i + 1}${extFromUrl(url)}` }));
}

function extFromUrl(url: string): string {
  try {
    const m = new URL(url).pathname.match(/\.[a-zA-Z0-9]+$/);
    return m ? m[0] : "";
  } catch {
    return "";
  }
}

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return base || fallback;
  } catch {
    return fallback;
  }
}

// pc-scan / pc-register 공용 프로퍼티 빌더 (설치프로그램은 files 로 별도 처리).
function buildPcScanProperties(d: Record<string, unknown>): Props {
  return {
    "PC이름": P.title(d.pcName),
    "시리얼 넘버": P.text(d.serial),
    "자산번호": P.text(d.assetNo),
    "제조사": P.text(d.manufacturer),
    "모델명": P.text(d.model),
    "법인명": P.select(d.corp),
    "겸직/쉐어드": P.checkbox(d.isDualOrShared),
    "원소속법인": P.select(d.originalCorp),
    "부서": P.text(d.dept),
    "사용자": P.text(d.userName),
    "이메일": P.email(d.email),
    "CPU": P.text(d.cpu),
    "RAM": P.text(d.ram),
    "OS": P.text(d.os),
    "GPU": P.text(d.gpu),
    "저장장치": P.text(d.storage),
    "MAC": P.text(d.mac),
    "수집일시": P.date(d.collectedAt),
    "단가": P.number(d.price),
    "마스터존재": P.checkbox(d.masterExists),
    "등록완료": P.checkbox(d.registered),
    "등록일시": P.date(d.registeredAt),
    "종료": P.checkbox(d.closed),
  };
}

// ── 초기 이관(seed) 소스 ─────────────────────────────────────────────────────
// 현재 Notion 데이터를 미러(entity_store)로 1회 적재할 때 사용한다(dirty=false 로 시작).
// id 는 기존 Notion page id 를 그대로 써서 앱 레코드 id 안정성과 백업 대상 매칭을 유지한다.
export interface EntitySeedSource {
  fetch: () => Promise<{ id: string; notionId: string; data: Record<string, unknown> }[]>;
}

/**
 * 엔티티키 → Notion 에서 현재 레코드를 읽어오는 함수. Batch B/C 전환 시 각 엔티티의
 * 기존 lib fetch 함수를 감싸 등록한다.
 */
export const seedRegistry: Record<string, EntitySeedSource> = {
  "meeting-equipment": {
    fetch: async () => {
      const { fetchMeetingEquipmentFromNotion } = await import("@/lib/meeting-equipment");
      const rows = await fetchMeetingEquipmentFromNotion();
      return rows.map(r => ({ id: r.id, notionId: r.id, data: r as unknown as Record<string, unknown> }));
    },
  },
  "exchange-return": {
    fetch: async () => {
      const { fetchExchangeReturnsFromNotion } = await import("@/lib/exchange-return");
      const rows = await fetchExchangeReturnsFromNotion();
      return rows.map(r => ({ id: r.id, notionId: r.id, data: r as unknown as Record<string, unknown> }));
    },
  },
  "rental-hw": {
    fetch: async () => {
      const { fetchRentalRecordsFromNotion } = await import("@/lib/rental-hw");
      const rows = await fetchRentalRecordsFromNotion();
      return rows.map(r => ({ id: r.id, notionId: r.id, data: r as unknown as Record<string, unknown> }));
    },
  },
  "contracts": {
    // 첨부파일을 Blob 으로 이관하므로 lib 의 전용 seed 함수를 사용한다.
    fetch: async () => {
      const { seedContractsFromNotion } = await import("@/lib/contract-notion");
      return seedContractsFromNotion();
    },
  },
  "pc-scan": {
    // 설치프로그램(xlsx)을 Blob 으로 이관하므로 lib 의 전용 seed 함수를 사용한다.
    fetch: async () => {
      const { seedPcScansFromNotion } = await import("@/lib/pc-scan");
      return seedPcScansFromNotion("NOTION_DB_PC_SCAN");
    },
  },
  "pc-register": {
    fetch: async () => {
      const { seedPcScansFromNotion } = await import("@/lib/pc-scan");
      return seedPcScansFromNotion("NOTION_DB_PC_REGISTER");
    },
  },
  "sw": {
    // 증서/기안문서를 Blob 으로 이관하므로 lib 의 전용 seed 함수를 사용한다.
    fetch: async () => {
      const { seedSwFromNotion } = await import("@/lib/sw-notion");
      return seedSwFromNotion();
    },
  },
  "hw-repair": {
    // 4개 파일 필드를 Blob 으로 이관하므로 lib 의 전용 seed 함수를 사용한다.
    fetch: async () => {
      const { seedHwRepairsFromNotion } = await import("@/lib/hw-repair");
      return seedHwRepairsFromNotion();
    },
  },
  "helpdesk": {
    fetch: async () => {
      const { fetchHelpDeskTicketsFromNotion } = await import("@/lib/notion");
      const rows = await fetchHelpDeskTicketsFromNotion();
      return rows.map(r => ({ id: r.id, notionId: r.id, data: r as unknown as Record<string, unknown> }));
    },
  },
  "repair": {
    fetch: async () => {
      const { fetchRepairTicketsFromNotion } = await import("@/lib/notion");
      const rows = await fetchRepairTicketsFromNotion();
      return rows.map(r => ({ id: r.id, notionId: r.id, data: r as unknown as Record<string, unknown> }));
    },
  },
  "meeting-rental": {
    fetch: async () => {
      const { fetchMeetingRentalTicketsFromNotion } = await import("@/lib/meeting-rental");
      const rows = await fetchMeetingRentalTicketsFromNotion();
      return rows.map(r => ({ id: r.id, notionId: r.id, data: r as unknown as Record<string, unknown> }));
    },
  },
  "credentials": {
    fetch: async () => {
      const dbId = process.env.NOTION_PAGE_CREDENTIALS;
      if (!dbId) return [];
      const { Client } = await import("@notionhq/client");
      const notion = new Client({ auth: process.env.NOTION_TOKEN });
      const getText = (prop: any) => prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      const out: { id: string; notionId: string; data: Record<string, unknown> }[] = [];
      let cursor: string | undefined;
      do {
        const res: any = await notion.databases.query({
          database_id: dbId,
          sorts: [{ timestamp: "created_time", direction: "ascending" }],
          start_cursor: cursor,
          page_size: 100,
        });
        for (const p of res.results as any[]) {
          out.push({
            id: p.id,
            notionId: p.id,
            data: {
              id: p.id,
              swName: p.properties["이름"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
              accountId: getText(p.properties["ID"]),
              password: getText(p.properties["PW"]),  // 암호문 그대로 보관
              siteUrl: p.properties["URL"]?.url ?? "",
              memo: getText(p.properties["유형"]),
              createdAt: p.created_time,
            },
          });
        }
        cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
      } while (cursor);
      return out;
    },
  },
  "survey-demand": {
    fetch: async () => {
      const dbId = process.env.NOTION_DB_SURVEY_DEMAND;
      if (!dbId) return [];
      const { Client } = await import("@notionhq/client");
      const notion = new Client({ auth: process.env.NOTION_TOKEN });
      const getText = (p: Record<string, any>, key: string) =>
        p?.[key]?.rich_text?.[0]?.plain_text ?? p?.[key]?.title?.[0]?.plain_text ?? "";
      const out: { id: string; notionId: string; data: Record<string, unknown> }[] = [];
      let cursor: string | undefined;
      do {
        const res: any = await notion.databases.query({
          database_id: dbId,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
          start_cursor: cursor,
          page_size: 100,
        });
        for (const p of res.results as any[]) {
          out.push({
            id: p.id,
            notionId: p.id,
            data: {
              id: p.id,
              name: getText(p.properties, "성함"),
              company: getText(p.properties, "소속법인"),
              department: getText(p.properties, "부서명"),
              email: p.properties["이메일"]?.email ?? "",
              purpose: (p.properties["사용목적"]?.multi_select ?? []).map((s: any) => s.name),
              language: (p.properties["주요언어"]?.multi_select ?? []).map((s: any) => s.name),
              frequency: getText(p.properties, "사용주기"),
              note: getText(p.properties, "특이사항"),
              submittedAt: p.properties["제출일시"]?.date?.start ?? p.created_time,
              notionUrl: p.url,
            },
          });
        }
        cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
      } while (cursor);
      return out;
    },
  },
};
