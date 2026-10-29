import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// v2 전환 뒤 DB 잠금 — 포털은 **잠그기만** 한다(여는 개인키는 포털에 절대 두지 않는다).
//
// 전환 뒤 맥북 DB 는 사본 스키마 `v2` 하나이고, 그 안의 행은 공개키로 잠근 암호문이다(데스크탑 앱
// core/db-crypto.ts·core/repo/db-seal.ts 와 같은 형식). 포털은
//   ① 직원 접수를 새 행으로 잠가 **추가만** 하고
//   ② 평문 예외(공지·강좌·SW 정책·자료실·매뉴얼·층 배치도·매뉴얼 추천)만 읽고 쓴다.
// 그 밖의 엔티티·KV 를 읽거나 고치려 하면 막는다 — 암호문을 평문처럼 다루는 사고를 구조로 막는다.
//
// 형식: 행마다 임시 X25519 키를 만들어 공개키와 ECDH → HKDF-SHA256 → AES-256-GCM.
//   db:v1:<공개키 지문 8자>:<base64(임시 공개키 32 | IV 12 | 태그 16 | 암호문)>
// jsonb 칸에는 {"enc": "db:v1:…"} 로 넣는다.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = "db:v1:";
const HKDF_INFO = Buffer.from("assetify-db v1");
const SPKI_HEAD = Buffer.from("302a300506032b656e032100", "hex");

/**
 * 평문 예외 — 데스크탑 앱 core/repo/db-seal.ts 와 **같은 목록**이어야 한다(앱이 평문으로 읽는다).
 * helpdesk:manual:* (매뉴얼 자동 추천)은 사용자 지시로 지금 동작 그대로 둔다.
 */
const PLAIN_ENTITIES = new Set(["sw-version", "sw-doc", "manual", "floor-map"]);
const PLAIN_KV_KEYS = new Set([
  "portal:notices",
  "portal:courses",
  "portal:swdb",
  "portal:saasdb",
  "assetAudit:config",
  "app:latest-release",
]);
const PLAIN_KV_PREFIXES = ["helpdesk:manual:"];

export function isPlainEntity(entity: string): boolean {
  return PLAIN_ENTITIES.has(entity);
}

export function isPlainKvKey(key: string): boolean {
  return PLAIN_KV_KEYS.has(key) || PLAIN_KV_PREFIXES.some(p => key.startsWith(p));
}

/** 포털이 읽거나 고칠 수 없는 데이터에 손댔을 때. 호출부를 고쳐야 하는 버그다. */
export class SealedDataError extends Error {}

export function assertPlainEntity(entity: string, op: string): void {
  if (!isPlainEntity(entity)) throw new SealedDataError(`포털은 "${entity}" 를 ${op}할 수 없습니다(암호문 — 추가만 가능).`);
}

export function assertPlainKvKey(key: string, op: string): void {
  if (!isPlainKvKey(key)) throw new SealedDataError(`포털은 KV "${key}" 를 ${op}할 수 없습니다(평문 예외만).`);
}

/** Vercel 환경변수 DB_PUBLIC_KEY(raw 32바이트 base64). 없으면 쓰기를 거부한다 — 평문이 v2 에 들어가지 않게. */
function publicKey(): Buffer {
  const b64 = process.env.DB_PUBLIC_KEY?.trim();
  if (!b64) throw new SealedDataError("DB_PUBLIC_KEY 가 없어 저장하지 않습니다(평문으로 쓰지 않는다).");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new SealedDataError("DB_PUBLIC_KEY 는 32바이트 base64 여야 합니다.");
  return key;
}

function seal(recipient: Buffer, plaintext: string): string {
  const eph = crypto.generateKeyPairSync("x25519");
  const ephPub = (eph.publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(SPKI_HEAD.length);
  const shared = crypto.diffieHellman({
    privateKey: eph.privateKey,
    publicKey: crypto.createPublicKey({ key: Buffer.concat([SPKI_HEAD, recipient]), format: "der", type: "spki" }),
  });
  const key = Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.concat([ephPub, recipient]), HKDF_INFO, 32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const fp = crypto.createHash("sha256").update(recipient).digest("hex").slice(0, 8);
  return `${PREFIX}${fp}:${Buffer.concat([ephPub, iv, cipher.getAuthTag(), ct]).toString("base64")}`;
}

/** entity_store.data 에 넣을 값 — 평문 예외는 그대로, 나머지는 {"enc"} 로 잠근다. */
export function sealEntityData(entity: string, data: unknown): unknown {
  return isPlainEntity(entity) ? data : { enc: seal(publicKey(), JSON.stringify(data)) };
}
