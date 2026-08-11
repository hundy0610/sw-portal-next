#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# 중앙 DB(맥북) → 콜드 스페어(Windows PC)용 일일 백업.
#
# pg_dump 커스텀 포맷(-Fc)으로 전체 스키마+데이터를 백업한다(public.hw, public.kv,
# public.entity_store 전부 포함 — kv는 Notion 백업 대상이 아니므로 이 백업이 유일한
# 원본 보존 수단이다). 오래된 백업은 자동 정리한다.
#
# 맥북에서 launchd로 매일 실행한다. deploy/com.swportal.backup-central-db.plist 참고.
# 상세 설계: docs/COLD-SPARE-WINDOWS.md
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${SWPORTAL_BACKUP_DIR:-$HOME/swportal-backups}"
KEEP_DAYS="${SWPORTAL_BACKUP_KEEP_DAYS:-14}"

: "${PGHOST:?PGHOST 환경변수가 필요합니다}"
: "${PGPORT:?PGPORT 환경변수가 필요합니다}"
: "${PGUSER:?PGUSER 환경변수가 필요합니다}"
: "${PGPASSWORD:?PGPASSWORD 환경변수가 필요합니다}"
: "${PGDATABASE:?PGDATABASE 환경변수가 필요합니다}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/swportal-$TIMESTAMP.dump"
LATEST_LINK="$BACKUP_DIR/swportal-latest.dump"

echo "[backup] $TIMESTAMP → $OUT_FILE"

pg_dump \
  --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" \
  --format=custom --no-owner --no-privileges \
  --file="$OUT_FILE"

# Windows 쪽 restore 스크립트가 항상 같은 파일명으로 최신 백업을 scp 해갈 수 있게
# 심볼릭 링크를 최신 파일로 갱신한다.
ln -sf "$OUT_FILE" "$LATEST_LINK"

echo "[backup] 완료: $(du -h "$OUT_FILE" | cut -f1)"

# 보관 기간(기본 14일) 초과 백업 정리
find "$BACKUP_DIR" -name 'swportal-*.dump' -mtime +"$KEEP_DAYS" -print -delete

echo "[backup] 정리 완료 (보관 기간: ${KEEP_DAYS}일)"
