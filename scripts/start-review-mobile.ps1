param([switch]$Phone, [string]$ApiHost = '172.20.235.186')
$reviewRoot = Split-Path $PSScriptRoot -Parent
$reviewPreviousDirectory = Get-Location
$reviewOldMode = $env:EXPO_PUBLIC_REVIEW_MODE
$reviewOldUrl = $env:EXPO_PUBLIC_API_URL
$reviewOldHost = $env:REACT_NATIVE_PACKAGER_HOSTNAME
try {
    Set-Location (Join-Path $reviewRoot 'apps/mobile')
    $env:EXPO_PUBLIC_REVIEW_MODE = 'true'
    $env:EXPO_PUBLIC_API_URL = "http://${ApiHost}:5180"
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ApiHost
    if ($Phone) { npx expo start --go --lan --port 8081 }
    else { npx expo start --web --go --port 8081 }
} finally {
    $env:EXPO_PUBLIC_REVIEW_MODE = $reviewOldMode
    $env:EXPO_PUBLIC_API_URL = $reviewOldUrl
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $reviewOldHost
    Set-Location $reviewPreviousDirectory
}
