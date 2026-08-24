<#
.SYNOPSIS
  Chrome/Edge 방문기록에서 도메인만 추출해 SaaS 사용 현황 서버로 보고한다.

.설명
  기존 PC 자산실사 에이전트(WPF, windows_recreate)와 무관하게 동작하는 독립 스크립트다.
  작업 스케줄러(Task Scheduler)로 하루 1회 SYSTEM 권한 실행을 권장한다 — SYSTEM으로
  실행해야 이 PC에 로그온한 모든 사용자 프로필의 방문기록을 읽을 수 있다(공용PC 대응).

  수집 범위는 "도메인 + 방문수 + 최근방문시각"뿐이다. URL 전체 경로·쿼리스트링·페이지
  제목은 절대 수집하지 않는다 — 방문한 서비스가 무엇인지만 알면 되고, 그 안에서 정확히
  무엇을 봤는지는 이 시스템의 목적이 아니다.

.의존성
  sqlite3.exe (3.33 이상, -json 출력 지원) — 이 스크립트와 같은 폴더에 두거나 PATH에
  등록되어 있어야 한다. https://sqlite.org/download.html 의 "sqlite-tools" 배포판에서
  받을 수 있다(공개 도메인 소프트웨어). 이 스크립트는 sqlite3.exe를 내려받지 않는다 —
  배포 담당자가 공식 사이트에서 직접 받아 체크섬을 확인한 뒤 배치해야 한다.

.배포
  같은 폴더의 README.md 참고.
#>

[CmdletBinding()]
param(
  # 배포 시 반드시 실제 값으로 교체한다.
  [string]$ReportUrl = "https://REPLACE-WITH-PORTAL-DOMAIN/api/saas-usage",
  [string]$IngestKey = "REPLACE-WITH-SAAS_SCAN_INGEST_KEY",
  # 이 PC가 속한 법인명(선택) — 지정하지 않으면 서버 쪽 HW 자산 대장과 나중에 수동 대조한다.
  [string]$Corp = "",
  [string]$Sqlite3Path = (Join-Path $PSScriptRoot "sqlite3.exe"),
  [string]$LogPath = "C:\ProgramData\SaasUsageCollector\collector.log"
)

$ErrorActionPreference = "Stop"

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  $dir = Split-Path $LogPath -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $LogPath -Value $line
  # 로그가 무한정 커지지 않도록 최근 2000줄만 유지
  $content = Get-Content -Path $LogPath -ErrorAction SilentlyContinue
  if ($content.Count -gt 2000) { $content | Select-Object -Last 2000 | Set-Content -Path $LogPath }
}

function Resolve-Sqlite3 {
  if (Test-Path $Sqlite3Path) { return $Sqlite3Path }
  $onPath = Get-Command "sqlite3.exe" -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  throw "sqlite3.exe를 찾을 수 없습니다. README.md의 의존성 항목을 참고해 배치해주세요."
}

# Chrome epoch(1601-01-01 UTC 기준 마이크로초) -> ISO 8601
function Convert-ChromeTime([long]$chromeMicroseconds) {
  if ($chromeMicroseconds -le 0) { return (Get-Date).ToUniversalTime().ToString("o") }
  $epoch = [DateTime]::new(1601, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
  return $epoch.AddSeconds($chromeMicroseconds / 1000000.0).ToString("o")
}

function Normalize-Host([string]$h) {
  if ([string]::IsNullOrWhiteSpace($h)) { return "" }
  $h = $h.ToLowerInvariant()
  if ($h.StartsWith("www.")) { $h = $h.Substring(4) }
  return $h
}

# 이 PC의 모든 사용자 프로필 아래 Chrome/Edge History 파일을 찾는다.
# 각 프로필 폴더(Default, Profile 1, ...)마다 History가 하나씩 있다.
function Find-HistoryFiles {
  $results = @()
  $userDataRoots = @()
  $skipUsers = @("Public", "Default", "Default User", "All Users")
  Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue | Where-Object { $skipUsers -notcontains $_.Name } | ForEach-Object {
    $base = $_.FullName
    $userDataRoots += Join-Path $base "AppData\Local\Google\Chrome\User Data"
    $userDataRoots += Join-Path $base "AppData\Local\Microsoft\Edge\User Data"
  }
  foreach ($root in $userDataRoots) {
    if (-not (Test-Path $root)) { continue }
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq "Default" -or $_.Name -like "Profile *" } |
      ForEach-Object {
        $historyFile = Join-Path $_.FullName "History"
        if (Test-Path $historyFile) { $results += $historyFile }
      }
  }
  return $results
}

function Get-VisitedDomainsFromHistory([string]$historyPath, [string]$sqlite3) {
  $tmpCopy = Join-Path $env:TEMP ("saashist_{0}.db" -f ([guid]::NewGuid().ToString("N")))
  try {
    # Chrome/Edge가 실행 중이면 History 파일이 잠겨 있어 직접 열 수 없다 — 복사본을 읽는다.
    Copy-Item -Path $historyPath -Destination $tmpCopy -Force -ErrorAction Stop
  } catch {
    Write-Log "복사 실패(사용 중일 수 있음), 건너뜀: $historyPath — $($_.Exception.Message)"
    return @()
  }
  try {
    $json = & $sqlite3 -json $tmpCopy "SELECT url, visit_count, last_visit_time FROM urls;" 2>$null
    if (-not $json) { return @() }
    return $json | ConvertFrom-Json
  } catch {
    Write-Log "쿼리 실패, 건너뜀: $historyPath — $($_.Exception.Message)"
    return @()
  } finally {
    Remove-Item $tmpCopy -Force -ErrorAction SilentlyContinue
  }
}

# ── 메인 ──────────────────────────────────────────────────────────────
try {
  $sqlite3 = Resolve-Sqlite3
  $historyFiles = Find-HistoryFiles
  Write-Log "History 파일 $($historyFiles.Count)개 발견"

  # host -> {visitCount, lastVisitedAt}
  $domains = @{}
  foreach ($hf in $historyFiles) {
    $rows = Get-VisitedDomainsFromHistory -historyPath $hf -sqlite3 $sqlite3
    foreach ($row in $rows) {
      $uri = $null
      try { $uri = [Uri]$row.url } catch { continue }
      if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") { continue }
      $host_ = Normalize-Host $uri.Host
      if ([string]::IsNullOrWhiteSpace($host_)) { continue }
      if ($host_ -eq "localhost" -or $uri.IsLoopback) { continue }

      $visitCount = [int]([Math]::Max(1, [int64]$row.visit_count))
      $lastVisited = Convert-ChromeTime ([int64]$row.last_visit_time)

      if ($domains.ContainsKey($host_)) {
        $domains[$host_].visitCount += $visitCount
        if ($lastVisited -gt $domains[$host_].lastVisitedAt) { $domains[$host_].lastVisitedAt = $lastVisited }
      } else {
        $domains[$host_] = [PSCustomObject]@{ host = $host_; visitCount = $visitCount; lastVisitedAt = $lastVisited }
      }
    }
  }

  $serial = (Get-CimInstance Win32_BIOS).SerialNumber
  $pcName = $env:COMPUTERNAME
  $userName = (Get-CimInstance Win32_ComputerSystem).UserName

  $payload = [PSCustomObject]@{
    pcName        = $pcName
    serial        = $serial
    userName      = $userName
    corp          = $Corp
    collectedAt   = (Get-Date).ToUniversalTime().ToString("o")
    domains       = @($domains.Values)
  }

  Write-Log "도메인 $($domains.Count)종 수집 완료, 전송 시도"

  $body = $payload | ConvertTo-Json -Depth 5
  $headers = @{ "x-scan-key" = $IngestKey; "Content-Type" = "application/json" }
  $resp = Invoke-RestMethod -Uri $ReportUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30

  if ($resp.ok) {
    Write-Log "전송 성공 (domainsReceived=$($resp.domainsReceived))"
  } else {
    Write-Log "전송 실패(서버 응답): $($resp.error)"
  }
} catch {
  Write-Log "실행 중 오류: $($_.Exception.Message)"
}
