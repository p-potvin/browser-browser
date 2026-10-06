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

$TempStage = Join-Path $DistPath "_staging"
if (Test-Path $TempStage) { Remove-Item $TempStage -Recurse -Force }
New-Item -ItemType Directory -Path $TempStage -Force | Out-Null
$StageRoot = (Resolve-Path $TempStage).Path

try {
    Copy-Item (Join-Path $ProjectRoot "manifest.json") $TempStage
    Copy-Item (Join-Path $ProjectRoot "assets") $TempStage -Recurse
    Copy-Item (Join-Path $ProjectRoot "src") $TempStage -Recurse
    if (Test-Path (Join-Path $ProjectRoot "vaultwares-themes")) {
        Copy-Item (Join-Path $ProjectRoot "vaultwares-themes") $TempStage -Recurse
    }

    # Guarantee forward slashes ('/') in ZIP entry paths.
    # Windows Compress-Archive uses backslashes ('\') which causes Firefox nsZipArchive to reject
    # the archive with: "Invalid file name in archive: assets\favicon.svg"
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $zipStream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::Create)
    $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

    try {
        Get-ChildItem -Path $StageRoot -Recurse -File | ForEach-Object {
            $fullPath = (Resolve-Path $_.FullName).Path
            $relPath = $fullPath.Substring($StageRoot.Length).TrimStart('\', '/')
            # Enforce forward slash path separators required by ZIP specification and Firefox nsZipArchive
            $entryName = $relPath.Replace('\', '/')
            $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = $_.LastWriteTime
            $entryStream = $entry.Open()
            $fileStream = [System.IO.File]::OpenRead($_.FullName)
            try {
                $fileStream.CopyTo($entryStream)
            }
            finally {
                $fileStream.Dispose()
                $entryStream.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
        $zipStream.Dispose()
    }

    Copy-Item $ZipPath $XpiPath

    Write-Host "Extension packaged successfully with forward slashes:" -ForegroundColor Green
    Write-Host "   ZIP: $ZipPath" -ForegroundColor Gray
    Write-Host "   XPI: $XpiPath" -ForegroundColor Gray
}
finally {
    if (Test-Path $TempStage) {
        Remove-Item $TempStage -Recurse -Force -ErrorAction SilentlyContinue
    }
}
