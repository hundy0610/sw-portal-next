[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ★ GitHub Personal Access Token 을 아래에 입력하세요 (repo 권한 필요)
$token  = "YOUR_GITHUB_TOKEN_HERE"
$repo   = "hundy0610/sw-portal-next"
$branch = "main"
$base   = "https://api.github.com/repos/$repo/contents"
$headers = @{
    "Authorization" = "token $token"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "PS-SchemaFix"
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 수정된 파일 목록 (HW/SW Notion 스키마 동기화)
# 마지막 파일만 Vercel 빌드 트리거 (나머지는 [vercel skip])
$files = @(
    "lib\hw.ts",
    "lib\notion.ts",
    "types\index.ts",
    "app\api\hw\update\route.ts",
    "app\api\sw\update\route.ts",
    "components\admin\HwPanel.tsx"
)

$ok = 0; $fail = 0
$lastIdx = $files.Count - 1

for ($fi = 0; $fi -lt $files.Count; $fi++) {
    $rel        = $files[$fi]
    $localPath  = Join-Path $root $rel
    $remotePath = $rel -replace '\\', '/'
    $isLast     = ($fi -eq $lastIdx)

    if (-not (Test-Path $localPath)) {
        Write-Host "SKIP (not found): $rel" -ForegroundColor Yellow
        continue
    }

    try {
        $bytes = $null
        try   { $bytes = Get-Content -Path $localPath -AsByteStream -ErrorAction Stop }
        catch { $bytes = Get-Content -Path $localPath -Encoding Byte -ErrorAction Stop }

        if ($null -eq $bytes -or $bytes.Count -eq 0) {
            Write-Host "SKIP (empty): $rel" -ForegroundColor Yellow
            continue
        }

        $encoded = [Convert]::ToBase64String($bytes)

        $sha = $null
        try {
            $remote = Invoke-RestMethod -Uri "$base/$remotePath" -Headers $headers -ErrorAction Stop
            $sha = $remote.sha
        } catch { }

        $msg = if ($isLast) { "fix: sync HW/SW edit with updated Notion schema" } else { "update: $remotePath [vercel skip]" }

        $bodyObj = [ordered]@{ message = $msg; content = $encoded; branch = $branch }
        if ($sha) { $bodyObj["sha"] = $sha }
        $body = $bodyObj | ConvertTo-Json -Compress -Depth 3

        $r = Invoke-RestMethod -Method PUT -Uri "$base/$remotePath" -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop

        $short = $r.commit.sha.Substring(0, 7)
        $tag = if ($isLast) { "[BUILD]" } else { "[skip] " }
        Write-Host "OK $tag : $rel ($short)" -ForegroundColor $(if ($isLast) { "Cyan" } else { "Green" })
        $ok++

    } catch {
        Write-Host "FAIL: $rel -> $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host "Done: OK=$ok FAIL=$fail" -ForegroundColor Cyan
if ($ok -gt 0 -and $fail -eq 0) { Write-Host "Vercel 빌드 트리거 완료!" -ForegroundColor Green }
