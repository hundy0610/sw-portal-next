import { kvGet, kvSetPermanent } from "@/lib/kv-store";

const CONFIG_KEY = "assetAudit:config";

export interface AssetAuditConfig {
  open: boolean;
  title: string;
  description: string;
  guide: string;
  version: string;
  // 협조문 — 어떤 데이터가 수집되는지 직원에게 반드시 고지 (줄바꿈으로 구분되는 목록)
  dataCollectionNotice: string;
  deadline: string | null; // 참여 마감일 (YYYY-MM-DD), 없으면 상시 진행
  windowsFileUrl: string | null;
  windowsFileName: string | null;
  windowsFileSize: number | null;
  macFileUrl: string | null;
  macFileName: string | null;
  macFileSize: number | null;
  updatedAt: string | null;
}

// 구버전 단일 파일 스키마 (레거시 KV 데이터 하위호환용)
interface LegacyFileFields {
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

const DEFAULT_CONFIG: AssetAuditConfig = {
  open: false,
  title: "대웅 그룹사 노트북/데스크탑 자산실사",
  description: "임직원 여러분의 소중한 시간을 아끼기 위해, 프로그램 실행만으로 간단히 참여할 수 있도록 준비했습니다.",
  guide:
    "1. 아래 내용에 동의 후, 사용 중인 운영체제에 맞는 프로그램을 다운로드합니다.\n" +
    "2. 다운로드한 파일을 실행합니다.\n" +
    "3. 실행이 완료되면 자산 정보가 자동으로 수집되어 등록됩니다. 별도로 입력하실 내용은 없습니다.",
  version: "",
  dataCollectionNotice:
    "CPU/GPU/메모리/저장장치/네트워크/배터리 정보\n" +
    "설치된 프로그램 목록\n" +
    "PC 자산번호, 시리얼번호, 모델명 등 하드웨어 사양\n" +
    "사용자 이름 및 소속 부서 정보",
  deadline: null,
  windowsFileUrl: null,
  windowsFileName: null,
  windowsFileSize: null,
  macFileUrl: null,
  macFileName: null,
  macFileSize: null,
  updatedAt: null,
};

export async function getAssetAuditConfig(): Promise<AssetAuditConfig> {
  const stored = await kvGet<Partial<AssetAuditConfig> & LegacyFileFields>(CONFIG_KEY);
  const merged = { ...DEFAULT_CONFIG, ...(stored ?? {}) };
  // 레거시 단일 파일 필드(fileUrl 등) → Windows 슬롯으로 마이그레이션 (하위호환)
  if (!merged.windowsFileUrl && stored?.fileUrl) {
    merged.windowsFileUrl = stored.fileUrl;
    merged.windowsFileName = stored.fileName ?? null;
    merged.windowsFileSize = stored.fileSize ?? null;
  }
  return merged;
}

export async function setAssetAuditConfig(patch: Partial<AssetAuditConfig>): Promise<AssetAuditConfig> {
  const current = await getAssetAuditConfig();
  const next = { ...current, ...patch };
  await kvSetPermanent(CONFIG_KEY, next);
  return next;
}
