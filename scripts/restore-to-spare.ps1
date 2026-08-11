# ─────────────────────────────────────────────────────────────────────────────
# 콜드 스페어(Windows PC)용 — 맥북의 최신 백업을 받아와 로컬 Postgres에 복원한다.
#
# 작업 스케줄러에 매일 새벽 등록해서 돌린다(예: 02:30). 콜드 스페어는 평소 트래픽을
# 받지 않으므로 --clean으로 매번 덮어써도 안전하다.
#
# 사전 준비:
#   - Windows에 OpenSSH 클라이언트 활성화 (설정 > 앱 > 선택적 기능)
#   - 맥북 쪽 원격 로그인(SSH) 허용 + 이 PC의 SSH 공개키를 맥북 ~/.ssh/authorized_keys에 등록
#   - 아래 환경변수를 이 스크립트 실행 전에 설정(또는 이 파일 상단 값을 직접 채움)
#
# 상세 설계: docs/COLD-SPARE-WINDOWS.md
# ─────────────────────────────────────────────────────────────────────────────

param(
  [string]$MacUser        = $env:SWPORTAL_MAC_SSH_USER,
  [string]$MacHost        = $env:SWPORTAL_MAC_TAILSCALE_HOST,   # 예: userui-macbookpro (Tailscale 호스트명 또는 IP)
  [string]$MacBackupPath  = "swportal-backups/swportal-latest.dump",
  [string]$LocalDumpPath  = "$env:TEMP\swportal-latest.dump",
  [string]$PgHost         = "localhost",
  [string]$PgPort         = "5432",
  [string]$PgUser         = "postgres",
  [string]$PgPassword     = $env:SWPORTAL_PG_PASSWORD,
  [string]$PgDatabase     = "postgres",
  [string]$LogFile        = "$PSScriptRoot\restore-to-spare.log"
)

function Write-Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Output $line
  Add-Content -Path $LogFile -Value $line
}

if (-not $MacUser -or -not $MacHost -or -not $PgPassword) {
  Write-Log "필수 값 누락 (SWPORTAL_MAC_SSH_USER / SWPORTAL_MAC_TAILSCALE_HOST / SWPORTAL_PG_PASSWORD). 중단."
  exit 1
}

try {
  Write-Log "맥북에서 최신 백업 받는 중: $MacUser@$MacHost`:$MacBackupPath"
  & scp "$MacUser@${MacHost}:$MacBackupPath" $LocalDumpPath
  if ($LASTEXITCODE -ne 0) { throw "scp 실패 (exit $LASTEXITCODE) — 맥북이 꺼져있거나 네트워크 문제일 수 있음" }

  $size = (Get-Item $LocalDumpPath).Length
  Write-Log "다운로드 완료: $([math]::Round($size/1MB, 2)) MB"

  $env:PGPASSWORD = $PgPassword
  Write-Log "로컬 Postgres에 복원 중 (기존 데이터는 덮어써짐 — 콜드 스페어라 안전)"
  & pg_restore --host=$PgHost --port=$PgPort --username=$PgUser --dbname=$PgDatabase --clean --if-exists --no-owner --no-privileges $LocalDumpPath
  if ($LASTEXITCODE -ne 0) { throw "pg_restore 실패 (exit $LASTEXITCODE)" }

  Write-Log "복원 완료. 스페어 DB가 맥북의 어제자 데이터로 동기화됨."
} catch {
  Write-Log "오류: $($_.Exception.Message)"
  exit 1
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  if (Test-Path $LocalDumpPath) { Remove-Item $LocalDumpPath -Force -ErrorAction SilentlyContinue }
}
