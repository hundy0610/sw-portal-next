/**
 * HW/SW Notion DB에 "마지막수정자", "마지막수정일시" rich_text 프로퍼티를 추가하는 1회성 스크립트.
 * 실행: node scripts/add-modifier-props.mjs
 */
import { Client } from "@notionhq/client";
import { readFileSync } from "fs";

// .env.local 수동 파싱 (dotenv 의존 없이)
const env = {};
try {
  const raw = readFileSync(".env.local", "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
} catch {
  console.error(".env.local 파일을 읽을 수 없습니다. 프로젝트 루트에서 실행하세요.");
  process.exit(1);
}

const notion = new Client({ auth: env.NOTION_TOKEN });

async function addModifierProps(dbId, dbName) {
  try {
    await notion.databases.update({
      database_id: dbId,
      properties: {
        "마지막수정자":   { rich_text: {} },
        "마지막수정일시": { rich_text: {} },
      },
    });
    console.log(`✅ [${dbName}] 프로퍼티 추가 완료`);
  } catch (e) {
    console.error(`❌ [${dbName}] 오류:`, e.message);
  }
}

const hwDbId = env.NOTION_DB_HW;
const swDbId = env.NOTION_DB_SW_UNIFIED;

if (!hwDbId) { console.error("NOTION_DB_HW 환경변수 없음"); process.exit(1); }
if (!swDbId) { console.error("NOTION_DB_SW_UNIFIED 환경변수 없음"); process.exit(1); }

console.log("Notion DB 프로퍼티 추가 시작...\n");
await addModifierProps(hwDbId, "HW 자산 DB");
await addModifierProps(swDbId, "SW 자산 DB");
console.log("\n완료. 이제 update API에서 수정자가 자동으로 기록됩니다.");
