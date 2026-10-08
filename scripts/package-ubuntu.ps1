$ErrorActionPreference = 'Stop'
$nodePackageRoot = Split-Path $PSScriptRoot -Parent
$nodePackagePrevious = Get-Location
$nodePackageOutput = $null
try {
    Set-Location $nodePackageRoot
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Node/web build failed.' }
    $nodePackageOutput = Join-Path $nodePackageRoot ('artifacts/ubuntu-node-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff'))
    New-Item -ItemType Directory -Path $nodePackageOutput | Out-Null
    foreach ($nodePackageItem in @('dist','wwwroot','package.json','package-lock.json')) {
        Copy-Item -LiteralPath (Join-Path $nodePackageRoot ('apps/api/' + $nodePackageItem)) -Destination $nodePackageOutput -Recurse
    }
    Copy-Item -LiteralPath (Join-Path $nodePackageRoot 'deploy/ubuntu') -Destination (Join-Path $nodePackageOutput 'deployment') -Recurse
    Copy-Item -LiteralPath (Join-Path $nodePackageRoot 'docs/deploy-ubuntu.md') -Destination (Join-Path $nodePackageOutput 'deployment/deploy-ubuntu.md')
    Copy-Item -LiteralPath (Join-Path $nodePackageRoot 'docs/registration-admin.md') -Destination (Join-Path $nodePackageOutput 'deployment/registration-admin.md')
    Copy-Item -LiteralPath (Join-Path $nodePackageRoot 'docs/auth-migration.sql') -Destination (Join-Path $nodePackageOutput 'deployment/auth-migration.sql')
    $nodePackageSchema = "USE [MEC];`nGO`n" + [IO.File]::ReadAllText((Join-Path $nodePackageRoot 'docs/database.sql'))
    [IO.File]::WriteAllText((Join-Path $nodePackageOutput 'deployment/schema-mec.sql'),$nodePackageSchema,[Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath (Join-Path $nodePackageOutput '.env')) { throw 'Private .env must not be packaged.' }
    $nodePackageArchive = Join-Path $nodePackageRoot 'artifacts/cliente-node.tar.gz'
    tar -czf $nodePackageArchive -C $nodePackageOutput .
    if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed.' }
    Write-Host "Node.js package: $nodePackageArchive"
} finally {
    Set-Location $nodePackagePrevious
    if ($nodePackageOutput -and (Test-Path -LiteralPath $nodePackageOutput)) {
        $nodePackageArtifacts = [IO.Path]::GetFullPath((Join-Path $nodePackageRoot 'artifacts'))
        $nodePackageResolved = [IO.Path]::GetFullPath($nodePackageOutput)
        if ([IO.Path]::GetDirectoryName($nodePackageResolved) -ne $nodePackageArtifacts -or
            -not [IO.Path]::GetFileName($nodePackageResolved).StartsWith('ubuntu-node-') -or
            ((Get-Item -LiteralPath $nodePackageResolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Unexpected package staging directory; cleanup stopped.'
        }
        Remove-Item -LiteralPath $nodePackageResolved -Recurse -Force
    }
}
