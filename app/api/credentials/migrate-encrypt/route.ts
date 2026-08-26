import { NextRequest, NextResponse } from "next/server";
import { readEntity, upsertEntity } from "@/lib/repo/mirror";
import { encryptSecret, isEncryptedSecret } from "@/lib/crypto";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

const CRED_ENTITY = "credentials";

interface CredentialRecord {
  id: string;
  swName: string;
  accountId: string;
  password: string;
  siteUrl: string;
  memo: string;
  createdAt: string;
}

// 일회성 마이그레이션 — 미러(entity "credentials")에 평문으로 남아 있는 PW 를 전부 암호화해
// 재저장한다. 이미 암호화된 값(enc:v1: 접두어)은 건너뛴다. 여러 번 실행해도 안전(idempotent).
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if ((await resolveCurrentRole(session)) !== "super") {
      return NextResponse.json({ ok: false, error: "슈퍼어드민만 실행할 수 있습니다." }, { status: 403 });
    }

    const rows = (await readEntity<CredentialRecord>(CRED_ENTITY)) ?? [];

    let migrated = 0, skipped = 0;
    for (const r of rows) {
      const pw = r.password || "";
      if (!pw || isEncryptedSecret(pw)) { skipped++; continue; }
      await upsertEntity(CRED_ENTITY, r.id, { ...r, password: encryptSecret(pw) });
      migrated++;
    }

    return NextResponse.json({ ok: true, migrated, skipped, total: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
