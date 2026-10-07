param([switch]$Install)
$ErrorActionPreference = 'Stop'
$webReviewRoot = Split-Path $PSScriptRoot -Parent
$webReviewPrevious = Get-Location
try {
    Set-Location (Join-Path $webReviewRoot 'apps/web')
    if ($Install -or -not (Test-Path -LiteralPath 'node_modules')) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'Không cài được dependency của web.' } }
    npm run dev
} finally { Set-Location $webReviewPrevious }
