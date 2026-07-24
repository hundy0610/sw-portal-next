import { Client } from "@notionhq/client";
import * as XLSX from "xlsx";
import { isMock } from "./mock";
import { findHwByAssetNo, serialFuzzyMatch, markHwVerifiedByScanMatch, fillMissingHwContactInfo, type HwRecord } from "./hw";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";
import { uploadToBlob } from "@/lib/blob-store";

// ─────────────────────────────────────────────────────────────────────────────
// PC 자산실사 스캔 (4.0verMACBOOK)
// 메인 저장소: 맥북 Postgres public.entity_store('pc-scan' | 'pc-register').
//   - NOTION_DB_PC_SCAN     → 'pc-scan'    (온라인 실사)
//   - NOTION_DB_PC_REGISTER → 'pc-register' (별도 등록 DB)
// 설치프로그램(xlsx) 첨부는 Vercel Blob 에 저장, 5분 백업 러너가 Notion 으로 재업로드.
// ─────────────────────────────────────────────────────────────────────────────

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function entityFor(dbEnvVar: string): string {
  return dbEnvVar === "NOTION_DB_PC_REGISTER" ? "pc-register" : "pc-scan";
}

// ─────────────────────────────────────────────────────────────────────────────
// 설치 프로그램 목록 xlsx 파싱 (이름 | 게시자 | 버전 | 설치일)
// ─────────────────────────────────────────────────────────────────────────────
export interface InstalledProgram {
  name: string;
  publisher: string;
  version: string;
  installDate: string;
}

export async function parseInstalledPrograms(fileUrl: string): Promise<InstalledProgram[]> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`파일을 가져올 수 없습니다 (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const programs: InstalledProgram[] = [];
  for (const row of rows.slice(1)) {
    const [name, publisher, version, installDate] = row as unknown[];
    if (!name) continue;
    programs.push({
      name: String(name).trim(),
      publisher: publisher ? String(publisher).trim() : "",
      version: version ? String(version).trim() : "",
      installDate: installDate ? String(installDate).trim() : "",
    });
  }
  return programs;
}

export interface PcScanPayload {
  pcName: string;
  serial: string;
  assetNo?: string;
  manufacturer?: string;
  model?: string;
  dept?: string;
  userName?: string;
  email?: string;
  macAddresses?: string[];
  cpu?: string;
  ram?: string;
  os?: string;
  gpu?: string;
  storage?: string;
  corp?: string;
  isDualOrShared?: boolean;
  originalCorp?: string;
  collectedAt?: string;
  price?: number;
  programsFileBase64?: string;
  programsFileName?: string;
  programsContentType?: string;
}

export interface UpsertResult {
  id: string;
  action: "created" | "updated";
  masterExists: boolean;
}

function toNotionId(raw: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  const h = raw.replace(/[-\s]/g, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(h) || h.length !== 32) {
    throw new Error(`유효하지 않은 Notion DB ID: "${raw}"`);
  }
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function queryWithRetry(
  params: Parameters<typeof notion.databases.query>[0],
  maxRetries = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await notion.databases.query(params);
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if ((status === 502 || status === 503) && attempt < maxRetries - 1) {
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Notion query failed after retries");
}

export interface PcScanRecord {
  id: string;
  pcName: string;
  serial: string;
  assetNo: string;
  manufacturer: string;
  model: string;
  corp: string;
  isDualOrShared: boolean;
  originalCorp: string;
  dept: string;
  userName: string;
  email: string;
  cpu: string;
  ram: string;
  os: string;
  gpu: string;
  storage: string;
  mac: string;
  collectedAt: string;
  price: number;
  masterExists: boolean;
  registered: boolean;
  registeredAt: string;
  closed: boolean;
  programFileName: string;
  programFileUrl: string;
  notionUrl: string;
}

export interface PcScanMismatch {
  corp: boolean;
  dept: boolean;
  userName: boolean;
}

export interface PcScanRecordWithMatch extends PcScanRecord {
  masterId: string | null;
  mismatch: PcScanMismatch | null;
  master?: { corp: string; dept: string; userName: string };
  serialOnlyMatch: { masterId: string; masterAssetNo: string; masterCorp: string; masterDept: string; masterUser: string } | null;
}

export function matchPcScansWithHw(
  scans: PcScanRecord[],
  hwRecords: HwRecord[]
): PcScanRecordWithMatch[] {
  const byAssetNo = new Map<string, HwRecord>();
  for (const r of hwRecords) {
    if (r.assetNo) byAssetNo.set(r.assetNo, r);
  }

  return scans.map(s => {
    const master = s.assetNo ? byAssetNo.get(s.assetNo) : undefined;
    const matched = !!master && serialFuzzyMatch(s.serial, master.serial);

    if (!matched || !master) {
      const bySerial = s.serial ? hwRecords.find(r => serialFuzzyMatch(s.serial, r.serial)) : undefined;
      return {
        ...s,
        masterExists: false,
        masterId: null,
        mismatch: null,
        serialOnlyMatch: bySerial
          ? { masterId: bySerial.id, masterAssetNo: bySerial.assetNo, masterCorp: bySerial.company, masterDept: bySerial.dept, masterUser: bySerial.user }
          : null,
      };
    }

    return {
      ...s,
      masterExists: true,
      masterId: master.id,
      mismatch: {
        corp:     master.company !== s.corp,
        dept:     master.dept    !== s.dept,
        userName: master.user    !== s.userName,
      },
      master: { corp: master.company, dept: master.dept, userName: master.user },
      serialOnlyMatch: null,
    };
  });
}

// ── Notion 페이지 → PcScanRecord (폴백/시드용) ─────────────────────────────────
function mapNotionPage(page: { id: string; properties: Record<string, { type: string; [k: string]: unknown }> }): PcScanRecord {
  const p = page.properties;
  const rt = (key: string) => {
    const v = p[key];
    if (!v || v.type !== "rich_text") return "";
    return (v.rich_text as { plain_text: string }[]).map(t => t.plain_text).join("");
  };
  const title = (key: string) => {
    const v = p[key];
    if (!v || v.type !== "title") return "";
    return (v.title as { plain_text: string }[]).map(t => t.plain_text).join("");
  };
  const files = p["설치프로그램"]?.type === "files"
    ? (p["설치프로그램"].files as { name?: string; type: string; file?: { url: string }; external?: { url: string } }[])
    : [];
  const f = files[0];
  return {
    id:           page.id,
    notionUrl:    `https://www.notion.so/${page.id.replace(/-/g, "")}`,
    pcName:       title("PC이름"),
    serial:       rt("시리얼 넘버"),
    assetNo:      rt("자산번호"),
    manufacturer: rt("제조사"),
    model:        rt("모델명"),
    corp:         (p["법인명"]?.type === "select" ? (p["법인명"].select as { name?: string } | null)?.name : "") ?? "",
    isDualOrShared: p["겸직/쉐어드"]?.type === "checkbox" ? (p["겸직/쉐어드"].checkbox as boolean) : false,
    originalCorp: (p["원소속법인"]?.type === "select" ? (p["원소속법인"].select as { name?: string } | null)?.name : "") ?? "",
    dept:         rt("부서"),
    userName:     rt("사용자"),
    email:        (p["이메일"]?.type === "email" ? p["이메일"].email as string | null : "") ?? "",
    cpu:          rt("CPU"),
    ram:          rt("RAM"),
    os:           rt("OS"),
    gpu:          rt("GPU"),
    storage:      rt("저장장치"),
    mac:          rt("MAC"),
    collectedAt:  (p["수집일시"]?.type === "date" ? (p["수집일시"].date as { start?: string } | null)?.start : "") ?? "",
    price:        p["단가"]?.type === "number" ? ((p["단가"].number as number | null) ?? 0) : 0,
    masterExists: p["마스터존재"]?.type === "checkbox" ? (p["마스터존재"].checkbox as boolean) : false,
    registered:   p["등록완료"]?.type === "checkbox" ? (p["등록완료"].checkbox as boolean) : false,
    registeredAt: (p["등록일시"]?.type === "date" ? (p["등록일시"].date as { start?: string } | null)?.start : "") ?? "",
    closed:       p["종료"]?.type === "checkbox" ? (p["종료"].checkbox as boolean) : false,
    programFileName: f?.name ?? "",
    programFileUrl:  f?.file?.url ?? f?.external?.url ?? "",
  };
}

async function queryAllNotion(dbEnvVar: string): Promise<PcScanRecord[]> {
  const rawDbId = process.env[dbEnvVar];
  if (!rawDbId) throw new Error(`${dbEnvVar} 환경변수가 설정되지 않았습니다.`);
  const dbId = toNotionId(rawDbId);
  const records: PcScanRecord[] = [];
  let cursor: string | undefined;
  do {
    const res = await queryWithRetry({
      database_id: dbId,
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      start_cursor: cursor,
    });
    for (const page of res.results) {
      if (page.object !== "page" || !("properties" in page)) continue;
      records.push(mapNotionPage(page as unknown as { id: string; properties: Record<string, { type: string; [k: string]: unknown }> }));
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return records;
}

export async function fetchPcScans(dbEnvVar: string = "NOTION_DB_PC_SCAN"): Promise<PcScanRecord[]> {
  if (isMock()) return [];
  const mir = await readEntity<PcScanRecord>(entityFor(dbEnvVar));
  if (mir) return [...mir].sort((a, b) => (b.collectedAt || "") < (a.collectedAt || "") ? -1 : 1);
  return queryAllNotion(dbEnvVar);
}

/** 초기 이관(seed)용 — Notion 스캔을 읽고 설치프로그램 파일을 Blob 으로 옮겨 미러 data 로 반환. */
export async function seedPcScansFromNotion(dbEnvVar: string): Promise<{ id: string; notionId: string; data: Record<string, unknown> }[]> {
  const rows = await queryAllNotion(dbEnvVar);
  const out: { id: string; notionId: string; data: Record<string, unknown> }[] = [];
  for (const r of rows) {
    const data: Record<string, unknown> = { ...r };
    if (r.programFileUrl && /^https?:\/\//.test(r.programFileUrl)) {
      try {
        const dl = await fetch(r.programFileUrl);
        if (dl.ok) {
          const buf = Buffer.from(await dl.arrayBuffer());
          const ct = dl.headers.get("content-type") || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          const blobUrl = await uploadToBlob(buf, r.programFileName || "programs.xlsx", ct, entityFor(dbEnvVar));
          data.programFileUrl = blobUrl;
          data.__syncedFiles = { "설치프로그램": blobUrl };
        }
      } catch (e) {
        console.warn(`[pc-scan seed] 파일 이관 실패(${r.id}):`, (e as Error).message);
      }
    }
    out.push({ id: r.id, notionId: r.id, data });
  }
  return out;
}

// 관리자가 수정 가능한 필드
export interface PcScanEditFields {
  assetNo?: string;
  manufacturer?: string;
  model?: string;
  corp?: string;
  isDualOrShared?: boolean;
  originalCorp?: string;
  dept?: string;
  userName?: string;
  email?: string;
  cpu?: string;
  ram?: string;
  os?: string;
  gpu?: string;
  storage?: string;
  mac?: string;
  price?: number;
  registered?: boolean;
  registeredAt?: string;
  closed?: boolean;
}

export async function updatePcScan(id: string, fields: PcScanEditFields, dbEnvVar: string = "NOTION_DB_PC_SCAN"): Promise<void> {
  const entity = entityFor(dbEnvVar);
  const base = await readEntityOne<PcScanRecord>(entity, id);
  if (!base) throw new Error("대상 스캔 레코드를 찾을 수 없습니다.");
  const next: PcScanRecord = { ...base };
  if (fields.assetNo        !== undefined) next.assetNo = fields.assetNo;
  if (fields.manufacturer   !== undefined) next.manufacturer = fields.manufacturer;
  if (fields.model          !== undefined) next.model = fields.model;
  if (fields.corp           !== undefined) next.corp = fields.corp;
  if (fields.isDualOrShared !== undefined) next.isDualOrShared = fields.isDualOrShared;
  if (fields.originalCorp   !== undefined) next.originalCorp = fields.originalCorp;
  if (fields.dept           !== undefined) next.dept = fields.dept;
  if (fields.userName       !== undefined) next.userName = fields.userName;
  if (fields.email          !== undefined) next.email = fields.email;
  if (fields.cpu            !== undefined) next.cpu = fields.cpu;
  if (fields.ram            !== undefined) next.ram = fields.ram;
  if (fields.os             !== undefined) next.os = fields.os;
  if (fields.gpu            !== undefined) next.gpu = fields.gpu;
  if (fields.storage        !== undefined) next.storage = fields.storage;
  if (fields.mac            !== undefined) next.mac = fields.mac;
  if (fields.price          !== undefined) next.price = fields.price;
  if (fields.registered     !== undefined) next.registered = fields.registered;
  if (fields.registeredAt   !== undefined) next.registeredAt = fields.registeredAt;
  if (fields.closed         !== undefined) next.closed = fields.closed;

  const ok = await upsertEntity(entity, id, next);
  if (!ok) throw new Error("pc-scan 수정 실패(Postgres)");
}

export async function deletePcScan(id: string, dbEnvVar: string = "NOTION_DB_PC_SCAN"): Promise<void> {
  const ok = await deleteEntity(entityFor(dbEnvVar), id);
  if (!ok) throw new Error("pc-scan 삭제 실패(Postgres)");
}

export async function upsertPcScan(data: PcScanPayload, dbEnvVar: string = "NOTION_DB_PC_SCAN"): Promise<UpsertResult> {
  if (isMock()) {
    console.log("[MOCK] upsertPcScan", data.serial);
    return { id: "mock-pc-scan-1", action: "created", masterExists: false };
  }
  const entity = entityFor(dbEnvVar);

  // 마스터(HW) 대조 — HW 는 이미 Postgres 메인이지만 조회는 Notion 백업(최대 5분 지연) 경유.
  const hwRecord = data.assetNo
    ? await findHwByAssetNo(data.assetNo).catch(() => null)
    : null;
  const masterExists = !!hwRecord && serialFuzzyMatch(data.serial, hwRecord.serial);

  // 완전 일치 시 HW 자동 실사확인 / 부분 일치 시 연락정보 보정 (HW 쓰기는 Postgres write-through)
  const scanMac = data.macAddresses?.length ? data.macAddresses.join(", ") : undefined;
  const scanEmail = data.email || undefined;
  const scanCpu = data.cpu || undefined;
  const scanRam = data.ram || undefined;
  const alreadySynced = !!hwRecord
    && hwRecord.status === "사용중"
    && hwRecord.verified
    && (!scanMac   || hwRecord.mac === scanMac)
    && (!scanEmail || hwRecord.email === scanEmail)
    && (!scanCpu   || hwRecord.cpu === scanCpu)
    && (!scanRam   || hwRecord.ram === scanRam);
  const fullOrgMatch = !!hwRecord && masterExists
    && hwRecord.company === (data.corp ?? "")
    && hwRecord.dept    === (data.dept ?? "")
    && hwRecord.user    === (data.userName ?? "");

  if (hwRecord && fullOrgMatch && !alreadySynced) {
    await markHwVerifiedByScanMatch(hwRecord.id, { mac: scanMac, email: scanEmail, cpu: scanCpu, ram: scanRam })
      .catch(e => console.error("[pc-scan → hw 자동 실사확인 실패]", e));
  } else if (hwRecord && masterExists) {
    await fillMissingHwContactInfo(hwRecord.id, {
      mac:   !hwRecord.mac   ? scanMac   : undefined,
      email: !hwRecord.email ? scanEmail : undefined,
    }).catch(e => console.error("[pc-scan → hw MAC/이메일 보정 실패]", e));
  }

  // 설치프로그램 파일 → Blob 업로드
  let programFileUrl = "";
  let programFileName = "";
  if (data.programsFileBase64 && data.programsFileName) {
    const buffer = Buffer.from(data.programsFileBase64, "base64");
    programFileUrl = await uploadToBlob(
      buffer,
      data.programsFileName,
      data.programsContentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      entity,
    );
    programFileName = data.programsFileName;
  }

  // 기존 레코드: 시리얼 넘버 + PC이름 일치로 같은 기기 판단(BIOS 무의미 시리얼 중복 방지)
  const all = (await readEntity<PcScanRecord>(entity)) ?? [];
  const existing = all.find(r =>
    r.serial === data.serial && (!data.pcName || r.pcName === data.pcName),
  );

  const id = existing?.id ?? crypto.randomUUID();
  const record: PcScanRecord = {
    id,
    notionUrl:      existing?.notionUrl ?? "",
    pcName:         data.pcName,
    serial:         data.serial,
    assetNo:        data.assetNo ?? "",
    manufacturer:   data.manufacturer ?? "",
    model:          data.model ?? "",
    corp:           data.corp ?? "",
    isDualOrShared: !!data.isDualOrShared,
    originalCorp:   data.originalCorp ?? "",
    dept:           data.dept ?? "",
    userName:       data.userName ?? "",
    email:          data.email ?? "",
    cpu:            data.cpu ?? "",
    ram:            data.ram ?? "",
    os:             data.os ?? "",
    gpu:            data.gpu ?? "",
    storage:        data.storage ?? "",
    mac:            scanMac ?? "",
    collectedAt:    data.collectedAt ?? "",
    price:          typeof data.price === "number" ? data.price : 0,
    masterExists,
    // 관리자 플래그는 스캔 페이로드에 없으므로 기존값 보존
    registered:     existing?.registered ?? false,
    registeredAt:   existing?.registeredAt ?? "",
    closed:         existing?.closed ?? false,
    // 새 파일이 없으면 기존 첨부 유지
    programFileName: programFileName || (existing?.programFileName ?? ""),
    programFileUrl:  programFileUrl  || (existing?.programFileUrl  ?? ""),
  };

  const ok = await upsertEntity(entity, id, record);
  if (!ok) throw new Error("pc-scan 저장 실패(Postgres)");
  return { id, action: existing ? "updated" : "created", masterExists };
}
