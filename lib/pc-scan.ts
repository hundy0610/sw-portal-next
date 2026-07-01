import { Client } from "@notionhq/client";
import { isMock } from "./mock";
import { findHwBySerial } from "./hw";
import { uploadFileToNotion } from "./notion";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export interface PcScanPayload {
  pcName: string;
  serial: string;
  assetNo?: string;
  manufacturer?: string;
  model?: string;
  dept?: string;
  userName?: string;
  macAddresses?: string[];
  cpu?: string;
  ram?: string;
  os?: string;
  gpu?: string;
  storage?: string;
  corp?: string;
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
  if (data.macAddresses?.length) addRt("MAC", data.macAddresses.join(", "));
  addRt("CPU", data.cpu);
  addRt("RAM", data.ram);
  addRt("OS", data.os);
  addRt("GPU", data.gpu);
  addRt("저장장치", data.storage);
  if (data.corp) props["법인명"] = { select: { name: data.corp } };
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
  dept: string;
  userName: string;
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
        dept:         rt("부서"),
        userName:     rt("사용자"),
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

export async function upsertPcScan(data: PcScanPayload): Promise<UpsertResult> {
  if (isMock()) {
    console.log("[MOCK] upsertPcScan", data.serial);
    return { id: "mock-pc-scan-1", action: "created", masterExists: false };
  }

  const rawDbId = process.env.NOTION_DB_PC_SCAN;
  if (!rawDbId) throw new Error("NOTION_DB_PC_SCAN 환경변수가 설정되지 않았습니다.");
  const dbId = toNotionId(rawDbId);

  // 마스터 대조 (실패 시 false 폴백)
  const hwRecord = await findHwBySerial(data.serial).catch(() => null);
  const masterExists = hwRecord !== null;

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

  // 기존 페이지 조회 (serial 키)
  const res = await queryWithRetry({
    database_id: dbId,
    filter: { property: "시리얼 넘버", rich_text: { equals: data.serial } },
    page_size: 1,
  });

  const existing = res.results[0];

  if (existing) {
    await notion.pages.update({ page_id: existing.id, properties });
    return { id: existing.id, action: "updated", masterExists };
  }

  // TODO: "Default string"/"To be filled..." 같은 무의미 BIOS serial은
  //       pcName + 첫 MAC 조합을 폴백 키로 사용하는 것 고려
  const created = await notion.pages.create({
    parent: { database_id: dbId },
    properties,
  });
  return { id: created.id, action: "created", masterExists };
}
