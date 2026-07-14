import crypto from "crypto";

const PREFIX = "pbkdf2$";
const ITERATIONS = 10000;
const KEY_LEN = 32;
const DIGEST = "sha256";

// ─────────────────────────────────────────────────────────────────────────────
// 대칭키 암호화(AES-256-GCM) — 관리자가 원문을 다시 조회해야 하는 값(제3자 서비스
// 공유계정 비밀번호 등)에 사용. 로그인 비밀번호(hashPassword)는 단방향 해시라
// 여기에 재사용할 수 없음 — 조회가 필요한 값은 반드시 이 암복호화 쌍을 쓴다.
// ─────────────────────────────────────────────────────────────────────────────
const ENC_PREFIX = "enc:v1:";

function getEncKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENC_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENC_KEY 환경변수가 설정되지 않았습니다.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CREDENTIALS_ENC_KEY는 32바이트(base64)여야 합니다.");
  return key;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

// 기존에 평문으로 저장돼 있던 값과의 호환을 위해, enc:v1: 접두어가 없으면
// 평문으로 간주하고 그대로 반환한다 (verifyPassword의 레거시 평문 비교와 동일한 패턴).
export function decryptSecret(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith(ENC_PREFIX)) return stored; // 레거시 평문
  const [ivB64, authTagB64, ciphertextB64] = stored.slice(ENC_PREFIX.length).split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) return stored;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return stored; // 복호화 실패 — 원문 그대로 반환(데이터 유실 방지)
  }
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST)
    .toString("hex");
  return `${PREFIX}${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (stored.startsWith(PREFIX)) {
    const [salt, hash] = stored.slice(PREFIX.length).split(":");
    if (!salt || !hash) return false;
    const computed = crypto
      .pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST)
      .toString("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(hash, "hex")
      );
    } catch {
      return false;
    }
  }
  // Legacy plain-text comparison (backward compat)
  return password === stored;
}
