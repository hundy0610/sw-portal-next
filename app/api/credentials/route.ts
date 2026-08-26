import { NextRequest, NextResponse } from "next/server";
import { readEntity, readEntityOne, upsertEntity, deleteEntity, isMirrorEnabled } from "@/lib/repo/mirror";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const CRED_ENTITY = "credentials";

// 미러 저장 레코드(비밀번호는 암호화된 문자열로 보관).
interface CredentialRecord {
  id: string;
  swName: string;
  accountId: string;
  password: string;   // encryptSecret() 결과(암호문)
  siteUrl: string;
  memo: string;
  createdAt: string;
}

// 클라이언트 응답(비밀번호 복호화).
function toClient(r: CredentialRecord) {
  return {
    id: r.id,
    swName: r.swName,
    accountId: r.accountId,
    password: decryptSecret(r.password || ""),
    siteUrl: r.siteUrl,
    memo: r.memo,
  };
}

// ── GET: 전체 조회 ────────────────────────────────────────
// 4.0verMACBOOK: 맥북 Postgres 미러(entity "credentials")에서 조회. 비밀번호는 미러에
// 암호화 저장되며 응답 시 복호화한다.
export async function GET() {
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json({ missingEnv: "SUPABASE_URL", error: "데이터 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  try {
    const rows = (await readEntity<CredentialRecord>(CRED_ENTITY)) ?? [];
    const data = [...rows]
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
      .map(toClient);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}

// ── POST: 추가 ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { swName, siteUrl = "", accountId, password = "", memo = "" } = await req.json();
    if (!swName || !accountId) {
      return NextResponse.json({ error: "SW명과 아이디는 필수입니다." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const record: CredentialRecord = {
      id,
      swName: String(swName).trim(),
      accountId: String(accountId).trim(),
      password: encryptSecret(String(password).trim()),
      siteUrl: String(siteUrl).trim(),
      memo: String(memo).trim(),
      createdAt: new Date().toISOString(),
    };
    const ok = await upsertEntity(CRED_ENTITY, id, record);
    if (!ok) return NextResponse.json({ error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true, data: toClient(record) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: 수정 ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { id, swName, siteUrl, accountId, password, memo } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const base = await readEntityOne<CredentialRecord>(CRED_ENTITY, id);
    if (!base) return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });

    const next: CredentialRecord = { ...base };
    if (swName    !== undefined) next.swName = String(swName).trim();
    if (accountId !== undefined) next.accountId = String(accountId).trim();
    if (password  !== undefined) next.password = encryptSecret(String(password).trim());
    if (siteUrl   !== undefined) next.siteUrl = String(siteUrl).trim();
    if (memo      !== undefined) next.memo = String(memo).trim();

    const ok = await upsertEntity(CRED_ENTITY, id, next);
    if (!ok) return NextResponse.json({ error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true, data: toClient(next) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: 삭제 (소프트 삭제) ───────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    await deleteEntity(CRED_ENTITY, id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
