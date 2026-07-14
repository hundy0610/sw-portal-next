import { Client } from "@notionhq/client";
import * as XLSX from "xlsx";
import { isMock } from "./mock";
import { findHwByAssetNo, serialFuzzyMatch, markHwVerifiedByScanMatch, type HwRecord } from "./hw";
import { uploadFileToNotion } from "./notion";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ─────────────────────────────────────────────────────────────────────────────
// 설치 프로그램 목록 (자산실사 수집 에이전트가 첨부한 "설치 프로그램" xlsx) 파싱
// 시트 컬럼: 이름 | 게시자 | 버전 | 설치일
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
  for (const row of rows.slice(1)) { // 첫 행(헤더) 제외
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

function buildProperties(
  data: PcScanPayload,
  masterExists: boolean,
  fileUploadId?: string
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    "PC이름": { title: [{ text: { content: data.pcName } }] },
    "시리얼 넘버": { rich_text: [{ text: { content: data.serial } }] },
    "마스터존재": { checkbox: masterExists },
  };

  const addRt = (key: string, val?: string) => {
    if (val) props[key] = { rich_text: [{ text: { content: val } }] };
  };

  addRt("자산번호", data.assetNo);
  addRt("제조사", data.manufacturer);
  addRt("모델명", data.model);
  addRt("부서", data.dept);
  addRt("사용자", data.userName);
  if (data.email) props["이메일"] = { email: data.email };
  if (data.macAddresses?.length) addRt("MAC", data.macAddresses.join(", "));
  addRt("CPU", data.cpu);
  addRt("RAM", data.ram);
  addRt("OS", data.os);
  addRt("GPU", data.gpu);
  addRt("저장장치", data.storage);
  if (data.corp) props["법인명"] = { select: { name: data.corp } };
  props["겸직/쉐어드"] = { checkbox: !!data.isDualOrShared };
  props["원소속법인"] = data.originalCorp
    ? { select: { name: data.originalCorp } }
    : { select: null };
  if (data.collectedAt) props["수집일시"] = { date: { start: data.collectedAt } };
  if (fileUploadId && data.programsFileName) {
    props["설치프로그램"] = {
      files: [{ type: "file_upload", name: data.programsFileName, file_upload: { id: fileUploadId } }],
    };
  }

  return props;
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
  masterExists: boolean;
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
  mismatch: PcScanMismatch | null; // masterExists === true일 때만 값이 존재
  master?: { corp: string; dept: string; userName: string };
  /** 자산번호는 마스터와 다르지만 시리얼은 일치하는 레코드가 있는 경우 (자산번호 오기입 의심 경고용, 자동 반영 안 함) */
  serialOnlyMatch: { masterId: string; masterAssetNo: string; masterCorp: string; masterDept: string; masterUser: string } | null;
}

/**
 * PC 스캔 기록을 마스터(HW) DB와 대조: 자산번호로 마스터 레코드를 찾고,
 * 시리얼 넘버가 대조(뒷자리 누락 허용)되면 일치로 보고 법인/부서/사용자를 비교한다.
 * 자산번호로 못 찾거나 시리얼이 안 맞으면, 자산번호 오기입 여부를 알려주기 위해
 * 시리얼만으로 마스터 전체를 보조 검색한다 (경고 표시용, masterExists/mismatch에는 반영하지 않음).
 */
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

export async function fetchPcScans(): Promise<PcScanRecord[]> {
  if (isMock()) return [];

  const rawDbId = process.env.NOTION_DB_PC_SCAN;
  if (!rawDbId) throw new Error("NOTION_DB_PC_SCAN 환경변수가 설정되지 않았습니다.");
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
      const p = page.properties as Record<string, { type: string; [k: string]: unknown }>;
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
      records.push({
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
        masterExists: p["마스터존재"]?.type === "checkbox" ? (p["마스터존재"].checkbox as boolean) : false,
        ...(() => {
          const files = p["설치프로그램"]?.type === "files"
            ? (p["설치프로그램"].files as { name?: string; type: string; file?: { url: string } }[])
            : [];
          const f = files[0];
          return { programFileName: f?.name ?? "", programFileUrl: f?.file?.url ?? "" };
        })(),
      });
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return records;
}

// 관리자가 수정 가능한 필드 — PC이름/시리얼 넘버는 upsertPcScan의 기기 식별 키라서
// 여기서 바꾸면 다음 스캔이 별개 레코드로 새로 생성되므로 제외한다.
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
}

function buildEditProperties(fields: PcScanEditFields): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const txt = (name: string, val: string) => { props[name] = { rich_text: [{ text: { content: val } }] }; };

  if (fields.assetNo        !== undefined) txt("자산번호", fields.assetNo);
  if (fields.manufacturer   !== undefined) txt("제조사", fields.manufacturer);
  if (fields.model          !== undefined) txt("모델명", fields.model);
  if (fields.dept           !== undefined) txt("부서", fields.dept);
  if (fields.userName       !== undefined) txt("사용자", fields.userName);
  if (fields.cpu            !== undefined) txt("CPU", fields.cpu);
  if (fields.ram            !== undefined) txt("RAM", fields.ram);
  if (fields.os             !== undefined) txt("OS", fields.os);
  if (fields.gpu            !== undefined) txt("GPU", fields.gpu);
  if (fields.storage        !== undefined) txt("저장장치", fields.storage);
  if (fields.mac            !== undefined) txt("MAC", fields.mac);
  if (fields.email          !== undefined) props["이메일"] = fields.email ? { email: fields.email } : { email: null };
  if (fields.corp           !== undefined) props["법인명"] = fields.corp ? { select: { name: fields.corp } } : { select: null };
  if (fields.originalCorp   !== undefined) props["원소속법인"] = fields.originalCorp ? { select: { name: fields.originalCorp } } : { select: null };
  if (fields.isDualOrShared !== undefined) props["겸직/쉐어드"] = { checkbox: !!fields.isDualOrShared };

  return props;
}

export async function updatePcScan(id: string, fields: PcScanEditFields): Promise<void> {
  const properties = buildEditProperties(fields);
  if (Object.keys(properties).length === 0) return;
  await notion.pages.update({
    page_id: id,
    properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
  });
}

export async function deletePcScan(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}

export async function upsertPcScan(data: PcScanPayload): Promise<UpsertResult> {
  if (isMock()) {
    console.log("[MOCK] upsertPcScan", data.serial);
    return { id: "mock-pc-scan-1", action: "created", masterExists: false };
  }

  const rawDbId = process.env.NOTION_DB_PC_SCAN;
  if (!rawDbId) throw new Error("NOTION_DB_PC_SCAN 환경변수가 설정되지 않았습니다.");
  const dbId = toNotionId(rawDbId);

  // 마스터 대조: 자산번호로 마스터 레코드를 찾고, 시리얼 넘버가 대조(뒷자리 누락 허용)되면 일치
  // (실패 시 false 폴백)
  const hwRecord = data.assetNo
    ? await findHwByAssetNo(data.assetNo).catch(() => null)
    : null;
  const masterExists = !!hwRecord && serialFuzzyMatch(data.serial, hwRecord.serial);

  // 마스터값과 완전히 일치(법인/부서/사용자 모두 동일)하면 실사 확인된 것으로 보고
  // 해당 자산을 사용중 + 실사확인으로 자동 반영, MAC/이메일/CPU/RAM도 함께 최신화
  // (상태·실사확인·MAC·이메일·CPU·RAM이 이미 전부 반영돼 있으면 스킵)
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

  if (hwRecord && masterExists
    && hwRecord.company === (data.corp ?? "")
    && hwRecord.dept    === (data.dept ?? "")
    && hwRecord.user    === (data.userName ?? "")
    && !alreadySynced
  ) {
    await markHwVerifiedByScanMatch(hwRecord.id, {
      mac: scanMac, email: scanEmail, cpu: scanCpu, ram: scanRam,
    }).catch(e =>
      console.error("[pc-scan → hw 자동 실사확인 실패]", e)
    );
  }

  // 엑셀 파일 Notion 업로드
  let fileUploadId: string | undefined;
  if (data.programsFileBase64 && data.programsFileName && data.programsContentType) {
    const buffer = Buffer.from(data.programsFileBase64, "base64");
    fileUploadId = await uploadFileToNotion(buffer, data.programsFileName, data.programsContentType);
  }

  const properties = buildProperties(
    data,
    masterExists,
    fileUploadId
  ) as Parameters<typeof notion.pages.create>[0]["properties"];

  // 기존 페이지 조회: 시리얼 넘버 + PC이름이 모두 일치해야 같은 기기로 판단.
  // BIOS가 시리얼을 못 읽어 "Default string" 등 무의미한 값이 여러 기기에서
  // 동일하게 들어오는 경우, 시리얼만으로 판단하면 서로 다른 기기가 한 레코드로
  // 덮어써져 가장 최근 것만 남는 문제가 있었음 — PC이름을 추가 조건으로 걸어 방지.
  const existingFilter = data.pcName
    ? {
        and: [
          { property: "시리얼 넘버", rich_text: { equals: data.serial } },
          { property: "PC이름", title: { equals: data.pcName } },
        ],
      }
    : { property: "시리얼 넘버", rich_text: { equals: data.serial } };

  const res = await queryWithRetry({
    database_id: dbId,
    filter: existingFilter,
    page_size: 1,
  });

  const existing = res.results[0];

  if (existing) {
    await notion.pages.update({ page_id: existing.id, properties });
    return { id: existing.id, action: "updated", masterExists };
  }

  const created = await notion.pages.create({
    parent: { database_id: dbId },
    properties,
  });
  return { id: created.id, action: "created", masterExists };
}
