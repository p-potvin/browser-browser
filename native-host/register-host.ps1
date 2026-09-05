# register-host.ps1
# Builds the C++ Native Messaging Host and registers it with Mozilla Firefox.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Split-Path -Parent $scriptDir
$buildDir = Join-Path $scriptDir "build"
$releaseExe = Join-Path $buildDir "Release\browser_browser_host.exe"
$manifestPath = Join-Path $scriptDir "browser_browser_host.json"

Write-Host "=== Building browser_browser_host (Release) ===" -ForegroundColor Cyan
if (-not (Test-Path $buildDir)) {
    cmake -B $buildDir $scriptDir
}
cmake --build $buildDir --config Release

if (-not (Test-Path $releaseExe)) {
    Write-Error "Build failed: $releaseExe not found."
    exit 1
}

Write-Host "=== Updating Native Host Manifest ===" -ForegroundColor Cyan
$manifest = @{
    name = "browser_browser_host"
    description = "browser-browser C++ Native Messaging Host for Local Files, Everything Search, and Media Streaming"
    path = (Resolve-Path $releaseExe).Path
    type = "stdio"
    allowed_extensions = @("browser-browser@vaultwares.internal")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host "Manifest written to: $manifestPath" -ForegroundColor Green

Write-Host "=== Registering in Windows Registry for Firefox ===" -ForegroundColor Cyan
$regKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\browser_browser_host"

if (-not (Test-Path "HKCU:\Software\Mozilla\NativeMessagingHosts")) {
    New-Item -Path "HKCU:\Software\Mozilla\NativeMessagingHosts" -Force | Out-Null
}

if (-not (Test-Path $regKey)) {
    New-Item -Path $regKey -Force | Out-Null
}

Set-ItemProperty -Path $regKey -Name "(Default)" -Value (Resolve-Path $manifestPath).Path

$verified = (Get-ItemProperty -Path $regKey)."(Default)"
Write-Host "Successfully registered native host:" -ForegroundColor Green
Write-Host "  Registry Key: $regKey"
Write-Host "  Value:        $verified"
Write-Host "  Binary:       $((Resolve-Path $releaseExe).Path)"
Write-Host "Done! Firefox extension 'browser-browser' can now use Native Messaging." -ForegroundColor Cyan
