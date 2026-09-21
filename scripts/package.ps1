param(
    [string]$OutDir = "$PSScriptRoot\..\dist",
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$DistPath = Join-Path $ProjectRoot "dist"

if (-not (Test-Path $DistPath)) {
    New-Item -ItemType Directory -Path $DistPath -Force | Out-Null
}

$ZipName = "browser-browser-$Version.zip"
$XpiName = "browser-browser-$Version.xpi"
$ZipPath = Join-Path $DistPath $ZipName
$XpiPath = Join-Path $DistPath $XpiName

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
if (Test-Path $XpiPath) { Remove-Item $XpiPath -Force }

Write-Host "Packaging browser-browser v$Version from $ProjectRoot..." -ForegroundColor Cyan

$TempStage = Join-Path $env:TEMP "bb-stage-$([System.Guid]::NewGuid().ToString().Substring(0,8))"
New-Item -ItemType Directory -Path $TempStage -Force | Out-Null

try {
    Copy-Item (Join-Path $ProjectRoot "manifest.json") $TempStage
    Copy-Item (Join-Path $ProjectRoot "assets") $TempStage -Recurse
    Copy-Item (Join-Path $ProjectRoot "src") $TempStage -Recurse
    Copy-Item (Join-Path $ProjectRoot "vaultwares-themes\vaultsqware\vaultsqware.css") $TempStage -Recurse

    Compress-Archive -Path "$TempStage\*" -DestinationPath $ZipPath -CompressionLevel Optimal
    Copy-Item $ZipPath $XpiPath

    Write-Host "Extension packaged successfully:" -ForegroundColor Green
    Write-Host "   ZIP: $ZipPath" -ForegroundColor Gray
    Write-Host "   XPI: $XpiPath" -ForegroundColor Gray
}
finally {
    if (Test-Path $TempStage) {
        Remove-Item $TempStage -Recurse -Force -ErrorAction SilentlyContinue
    }
}
