import * as XLSX from "xlsx";
import { isMock } from "./mock";
import { findHwByAssetNo, serialFuzzyMatch, markHwVerifiedByScanMatch, fillMissingHwContactInfo, type HwRecord } from "./hw";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";
import { uploadToBlob } from "@/lib/blob-store";

// ─────────────────────────────────────────────────────────────────────────────
// PC 자산실사 스캔 (4.0verMACBOOK)
// 메인 저장소: 맥북 Postgres public.entity_store('pc-scan' | 'pc-register').
//   - 'pc-scan'     온라인 실사
//   - 'pc-register' 신규 등록(별도 저장소)
// 설치프로그램(xlsx) 첨부는 Vercel Blob 에 저장한다.
// ─────────────────────────────────────────────────────────────────────────────


/** 온라인 실사(pc-scan)와 신규 등록(pc-register)은 같은 코드에 저장소만 다르다. */
export type PcScanEntity = "pc-scan" | "pc-register";

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
  isShared?: boolean;
  sharedName?: string;
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
  /**
   * 공용PC — 여럿이 함께 쓰는 PC(회의실·검사장비 등). `isDualOrShared`(겸직/쉐어드,
   * 사람이 두 법인 일을 겸함)와 **다른 개념**이다.
   *
   * 예전에는 이 구분을 사용자 이름 규칙("용도_담당자이름_공용")으로 대신했다. 사람 칸에
   * 사람 아닌 값이 들어가 실사 진행률의 조직도 명단 대조가 어긋났다. 이제 에이전트가
   * 체크박스로 받고 userName 은 담당자 이름을 그대로 담는다.
   *
   * 이 필드가 생기기 전 레코드에는 없다(그래서 optional) — 그때는 false 로 본다.
   */
  isShared?: boolean;
  /** 공용 용도/위치. 예: "3층 회의실". 공용이 아니면 빈 값. */
  sharedName?: string;
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
  /**
   * 이 PC 가 수집된 시각 전부(오래된 것 → 최신). collectedAt 은 늘 마지막 수집
   * 시각으로 덮이므로, 같은 PC 가 다음 회차에 재스캔되면 이전 회차의 수집 시각이
   * 사라진다 — 회차별 진행률은 "그 기간에 수집됐는지"로 세기 때문에 지난 회차
   * 진행률이 소급해서 줄어든다. 그것을 막기 위한 이력이다.
   *
   * 이 필드가 생기기 전 레코드에는 없다(그래서 optional) — 그 레코드가 다시
   * 수집되는 순간 collectedAt 하나로 이력이 시작된다.
   */
  collectedHistory?: string[];
  price: number;
  masterExists: boolean;
  registered: boolean;
  registeredAt: string;
  closed: boolean;
  programFileName: string;
  programFileUrl: string;
  notionUrl: string;
}

/**
 * 수집 시각 이력에 이번 수집 시각을 더한다. 같은 시각은 한 번만 담고 오래된 순으로 둔다.
 * 이력이 없는(필드가 생기기 전) 레코드는 기존 collectedAt 하나로 이력을 시작한다 —
 * 안 그러면 이 변경 이후 첫 재스캔에서 옛 수집 시각이 그대로 사라진다.
 */
function appendCollectedAt(existing: PcScanRecord | undefined, at: string | undefined): string[] {
  const prev = Array.isArray(existing?.collectedHistory)
    ? existing!.collectedHistory!.filter(v => typeof v === "string" && v.trim() !== "")
    : [existing?.collectedAt ?? ""].filter(v => v.trim() !== "");
  const now = (at ?? "").trim();
  if (!now || prev.includes(now)) return prev;
  return [...prev, now].sort();
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

export async function fetchPcScans(entity: PcScanEntity = "pc-scan"): Promise<PcScanRecord[]> {
  if (isMock()) return [];
  const mir = await readEntity<PcScanRecord>(entity);
  if (!mir) throw new Error("미러(맥북 Postgres) 미설정 — SUPABASE_URL/SUPABASE_KEY 를 확인하세요.");
  return [...mir].sort((a, b) => (b.collectedAt || "") < (a.collectedAt || "") ? -1 : 1);
}

export interface PcScanEditFields {
  assetNo?: string;
  manufacturer?: string;
  model?: string;
  corp?: string;
  isDualOrShared?: boolean;
  originalCorp?: string;
  isShared?: boolean;
  sharedName?: string;
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

export async function updatePcScan(id: string, fields: PcScanEditFields, entity: PcScanEntity = "pc-scan"): Promise<void> {
    const base = await readEntityOne<PcScanRecord>(entity, id);
  if (!base) throw new Error("대상 스캔 레코드를 찾을 수 없습니다.");
  const next: PcScanRecord = { ...base };
  if (fields.assetNo        !== undefined) next.assetNo = fields.assetNo;
  if (fields.manufacturer   !== undefined) next.manufacturer = fields.manufacturer;
  if (fields.model          !== undefined) next.model = fields.model;
  if (fields.corp           !== undefined) next.corp = fields.corp;
  if (fields.isDualOrShared !== undefined) next.isDualOrShared = fields.isDualOrShared;
  if (fields.isShared       !== undefined) next.isShared = fields.isShared;
  if (fields.sharedName     !== undefined) next.sharedName = fields.sharedName;
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

export async function deletePcScan(id: string, entity: PcScanEntity = "pc-scan"): Promise<void> {
  const ok = await deleteEntity(entity, id);
  if (!ok) throw new Error("pc-scan 삭제 실패(Postgres)");
}

export async function upsertPcScan(data: PcScanPayload, entity: PcScanEntity = "pc-scan"): Promise<UpsertResult> {
  if (isMock()) {
    console.log("[MOCK] upsertPcScan", data.serial);
    return { id: "mock-pc-scan-1", action: "created", masterExists: false };
  }
  
  // 마스터(HW) 대조 — findHwByAssetNo는 Postgres 전용. 조회 실패 시 마스터 없음으로
  // 조용히 넘기지 않고 그대로 throw해 스캔 업로드 자체를 실패 처리한다.
  const hwRecord = data.assetNo ? await findHwByAssetNo(data.assetNo) : null;
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
    isShared:       !!data.isShared,
    // 공용이 아니면 용도는 버린다 — 개인 PC 에 용도가 남으면 화면에서 공용처럼 보인다.
    sharedName:     data.isShared ? (data.sharedName ?? "") : "",
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
    // collectedAt 은 의도대로 "마지막 수집 시각"으로 덮는다. 회차별 집계가 잃어버리는
    // 지난 수집 시각은 이력에 쌓아 남긴다.
    collectedHistory: appendCollectedAt(existing, data.collectedAt),
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
