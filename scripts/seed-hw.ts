/**
 * 초기 데이터 이관: Notion HW → 맥북 Postgres(자체 Supabase)  [1회 실행, 맥북에서]
 *
 * 실행:
 *   node --env-file=.env --import tsx scripts/seed-hw.ts
 *
 * 필요 env (.env, git 제외):
 *   NOTION_TOKEN   기존 Notion 읽기용
 *   SUPABASE_URL   보통 http://localhost:8000 (맥북 로컬에서 직접, 빠름)
 *   SUPABASE_KEY   service_role 키 (RLS 우회 — 쓰기 필요). 로컬에서만 사용, 절대 커밋/노출 금지
 *
 * 안전: 읽기 전용 Notion + Postgres upsert(id 기준). 기존 Notion 데이터는 변경하지 않음.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchAllHwRecords } from "../lib/hw";

const { NOTION_TOKEN, SUPABASE_URL, SUPABASE_KEY } = process.env;

function die(msg: string): never {
  console.error("✗ " + msg);
  process.exit(1);
}

if (!NOTION_TOKEN) die("NOTION_TOKEN 이 .env 에 없습니다.");
if (!SUPABASE_URL) die("SUPABASE_URL 이 .env 에 없습니다.");
if (!SUPABASE_KEY) die("SUPABASE_KEY(service_role) 이 .env 에 없습니다.");

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 500;

async function main() {
  console.log("→ Notion 에서 HW 전체 조회 중...");
  const all = await fetchAllHwRecords();
  console.log(`  Notion 레코드: ${all.length} 건`);
  if (all.length === 0) die("Notion 에서 0건 조회됨 — 토큰/DB 권한 확인 필요.");

  console.log(`→ Postgres 로 upsert (배치 ${BATCH})...`);
  let done = 0;
  for (let i = 0; i < all.length; i += BATCH) {
    const chunk = all.slice(i, i + BATCH);
    const { error } = await sb.from("hw").upsert(chunk, { onConflict: "id" });
    if (error) die(`upsert 실패 (배치 ${i}): ${error.message}`);
    done += chunk.length;
    process.stdout.write(`  진행: ${done}/${all.length}\r`);
  }
  console.log(`\n  upsert 완료: ${done} 건`);

  // 검증: 건수 비교
  const { count, error: cErr } = await sb
    .from("hw")
    .select("*", { count: "exact", head: true });
  if (cErr) die(`건수 조회 실패: ${cErr.message}`);

  console.log("\n=== 정합성 검증 ===");
  console.log(`  Notion 건수   : ${all.length}`);
  console.log(`  Postgres 건수 : ${count}`);
  console.log(`  일치 여부     : ${count === all.length ? "✓ 일치" : "✗ 불일치"}`);

  // 샘플 스팟체크 (앞 3건의 id/자산번호/사용자 — 시크릿 아님)
  const sampleIds = all.slice(0, 3).map((r) => r.id);
  const { data: sample } = await sb
    .from("hw")
    .select("id,assetNo,user,status,company")
    .in("id", sampleIds);
  console.log("\n=== 샘플 3건 (Postgres 저장 확인) ===");
  for (const s of sample ?? []) {
    console.log(`  ${s.assetNo || "(무자산번호)"} | ${s.user || "-"} | ${s.status || "-"} | ${s.company || "-"}`);
  }

  if (count !== all.length) {
    die("건수 불일치 — 로그 확인 필요.");
  }
  console.log("\n✓ 이관 및 검증 완료.");
}

main().catch((e) => die(String(e?.stack || e)));
