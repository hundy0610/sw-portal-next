import { kvGet, kvSetPermanent } from "@/lib/kv-store";

const CONFIG_KEY = "assetAudit:config";

export interface AssetAuditConfig {
  open: boolean;
  title: string;
  description: string;
  guide: string;
  version: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  updatedAt: string | null;
}

const DEFAULT_CONFIG: AssetAuditConfig = {
  open: false,
  title: "자산실사 프로그램",
  description: "PC에 설치하면 자산 정보를 자동으로 수집해 서버로 보고합니다.",
  guide: "1. 아래 다운로드 버튼을 눌러 설치 파일을 받습니다.\n2. 다운로드한 파일을 실행합니다.\n3. 완료되면 자동으로 자산 정보가 등록됩니다.",
  version: "",
  fileUrl: null,
  fileName: null,
  fileSize: null,
  updatedAt: null,
};

export async function getAssetAuditConfig(): Promise<AssetAuditConfig> {
  const stored = await kvGet<Partial<AssetAuditConfig>>(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...(stored ?? {}) };
}

export async function setAssetAuditConfig(patch: Partial<AssetAuditConfig>): Promise<AssetAuditConfig> {
  const current = await getAssetAuditConfig();
  const next = { ...current, ...patch };
  await kvSetPermanent(CONFIG_KEY, next);
  return next;
}
