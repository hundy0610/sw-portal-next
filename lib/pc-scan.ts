import * as XLSX from "xlsx";
import { isMock } from "./mock";
import { serialFuzzyMatch, type HwRecord } from "./hw";
import { insertEntity, readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";
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

/**
 * SaaS 도메인 방문기록을, 같은 serial의 가장 최근 pc-scan 레코드가 이미 갖고 있는
 * 설치프로그램 엑셀에 "SaaS 도메인" 시트로 얹어 재업로드하고, 그 레코드의 첨부 URL을
 * 새 파일로 갱신한다. 한 실사 라운드 안에서 HW/설치SW 보고(/api/pc-scan)가 먼저 오고
 * SaaS 도메인 보고(/api/saas-usage)가 뒤이어 온다는 전제 — 대상 레코드나 첨부가 아직
 * 없으면 아무것도 하지 않는다(POST /api/saas-usage 쪽에서 non-fatal 로 처리).
 */
export async function attachSaasDomainSheet(
  serial: string,
  domains: { host: string; visitCount: number; lastVisitedAt: string }[],
  sanitizeCell: (v: string) => string,
  entity: PcScanEntity = "pc-scan",
): Promise<boolean> {
  if (!serial || domains.length === 0) return false;
  const all = (await readEntity<PcScanRecord>(entity)) ?? [];
  // 같은 serial로 여러 회차 레코드가 있을 수 있어 collectedAt 최신 것을 대상으로 한다.
  const target = all
    .filter(r => r.serial === serial && r.programFileUrl)
    .sort((a, b) => (b.collectedAt || "").localeCompare(a.collectedAt || ""))[0];
  if (!target) return false;

  const res = await fetch(target.programFileUrl);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });

  const SHEET_NAME = "SaaS 도메인";
  const existingIdx = wb.SheetNames.indexOf(SHEET_NAME);
  if (existingIdx !== -1) {
    // 재실사 등으로 이미 이 시트가 있으면 지우고 새로 채운다(오래된 스냅샷이 남지 않게).
    delete wb.Sheets[SHEET_NAME];
    wb.SheetNames.splice(existingIdx, 1);
  }
  const rows = [
    ["도메인", "누적 방문수", "최근 방문일시"],
    ...domains.map(d => [sanitizeCell(d.host), d.visitCount, d.lastVisitedAt]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), SHEET_NAME);
  const merged = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);

  const newUrl = await uploadToBlob(
    merged,
    target.programFileName || "installed_programs.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    entity,
  );
  return upsertEntity(entity, target.id, { ...target, programFileUrl: newUrl });
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

/**
 * 실사·PC 등록 제출을 **받은 그대로 새 행**으로 남긴다(v2 전환 뒤 — 10-29 결정).
 *
 * 예전에는 여기서 HW 마스터를 읽어 대조하고(자동 실사확인·연락처 보정), 같은 PC 의 기존 제출 행을 찾아 합쳤다.
 * 전환 뒤 포털은 HW·제출 행을 읽을 수 없고(암호문) 고칠 수도 없다. 대조는 원래 데스크탑 앱이 하고
 * (matchPcScansWithHw), HW 수정은 관리자가 앱의 [동기화 확인]으로 한다. 같은 PC 의 여러 제출은 앱이 목록을
 * 보일 때 합친다. 그래서 여기서는 첨부를 올리고 잠가서 추가만 한다.
 */
export async function insertPcScanSubmission(data: PcScanPayload, entity: PcScanEntity = "pc-scan"): Promise<UpsertResult> {
  if (isMock()) {
    console.log("[MOCK] insertPcScanSubmission", data.serial);
    return { id: "mock-pc-scan-1", action: "created", masterExists: false };
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

  const id = crypto.randomUUID();
  const collectedAt = (data.collectedAt ?? "").trim();
  const record: PcScanRecord = {
    id,
    notionUrl:      "",
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
    mac:            data.macAddresses?.length ? data.macAddresses.join(", ") : "",
    collectedAt,
    collectedHistory: collectedAt ? [collectedAt] : [],
    price:          typeof data.price === "number" ? data.price : 0,
    // 대조는 앱이 한다 — 여기 값은 쓰지 않는다.
    masterExists:   false,
    registered:     false,
    registeredAt:   "",
    closed:         false,
    programFileName,
    programFileUrl,
  };

  const ok = await insertEntity(entity, id, record);
  if (!ok) throw new Error("pc-scan 저장 실패(Postgres)");
  return { id, action: "created", masterExists: false };
}
