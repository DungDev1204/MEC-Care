$ErrorActionPreference = 'Stop'
$webBuildRoot = Split-Path $PSScriptRoot -Parent
$webBuildPrevious = Get-Location
try {
    Set-Location (Join-Path $webBuildRoot 'apps/web')
    if (-not (Test-Path -LiteralPath 'node_modules')) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' } }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    $webBuildDestination = Join-Path $webBuildRoot 'apps/api/wwwroot'
    $webBuildWorkspace = [IO.Path]::GetFullPath($webBuildRoot).TrimEnd('\') + '\'
    $webBuildResolved = [IO.Path]::GetFullPath($webBuildDestination)
    if (-not $webBuildResolved.StartsWith($webBuildWorkspace, [StringComparison]::OrdinalIgnoreCase) -or $webBuildResolved -ne (Join-Path $webBuildRoot 'apps/api/wwwroot')) { throw 'Unexpected build destination.' }
    if (Test-Path -LiteralPath $webBuildResolved) { Remove-Item -LiteralPath $webBuildResolved -Recurse -Force }
    New-Item -ItemType Directory -Path $webBuildResolved -Force | Out-Null
    Get-ChildItem -LiteralPath 'dist' | Copy-Item -Destination $webBuildResolved -Recurse -Force
    Write-Host 'Web assets prepared in apps/api/wwwroot. Publish the API to deploy the complete web app.'
} finally { Set-Location $webBuildPrevious }
