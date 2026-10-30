# Packages the extension. manifest.json holds the version: each run bumps the minor (1.4.0 -> 1.5.0) and writes it
# back to manifest.json and the <!-- vX.Y.Z --> comments in the pages' <head>. -Version sets an exact version
# instead; -NoBump packages the current one as is.
param(
    [string]$OutDir = "$PSScriptRoot\..\dist",
    [string]$Version = "",
    [switch]$NoBump
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$DistPath = Join-Path $ProjectRoot "dist"

# Version: read from manifest.json, bump the minor, write it back (text replace, so the manifest's layout is kept)
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$ManifestPath = Join-Path $ProjectRoot "manifest.json"
$ManifestText = [System.IO.File]::ReadAllText($ManifestPath)
$VersionPattern = '("version"\s*:\s*")(\d+)\.(\d+)\.(\d+)(")'
$Current = [regex]::Match($ManifestText, $VersionPattern)
if (-not $Current.Success) { throw "No x.y.z version found in $ManifestPath" }
$CurrentVersion = "$($Current.Groups[2].Value).$($Current.Groups[3].Value).$($Current.Groups[4].Value)"

if (-not $Version) {
    $Version = if ($NoBump) { $CurrentVersion } else { "$($Current.Groups[2].Value).$([int]$Current.Groups[3].Value + 1).0" }
}
if ($Version -ne $CurrentVersion) {
    $ManifestText = ([regex]$VersionPattern).Replace($ManifestText, "`${1}$Version`${5}", 1)
    [System.IO.File]::WriteAllText($ManifestPath, $ManifestText, $Utf8NoBom)
    foreach ($page in @("src\app\manager.html", "src\options\options.html", "src\popup\popup.html")) {
        $pagePath = Join-Path $ProjectRoot $page
        $html = [System.IO.File]::ReadAllText($pagePath)
        [System.IO.File]::WriteAllText($pagePath, ($html -replace '<!-- v\d+\.\d+\.\d+ -->', "<!-- v$Version -->"), $Utf8NoBom)
    }
    Write-Host "Version $CurrentVersion -> $Version (manifest.json, page heads)" -ForegroundColor Cyan
}

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
    # Only copy the runtime vaultsqware theme needed by the extension.
    # Excludes external examples (>5MB HTML brand guides, tsconfig.json with block comments, etc.)
    $VaultsqwareSource = Join-Path $ProjectRoot "vaultwares-themes\vaultsqware"
    if (Test-Path $VaultsqwareSource) {
        $VaultsqwareTargetParent = Join-Path $TempStage "vaultwares-themes"
        New-Item -ItemType Directory -Path $VaultsqwareTargetParent -Force | Out-Null
        Copy-Item $VaultsqwareSource $VaultsqwareTargetParent -Recurse
    }

    # Guarantee forward slashes ('/') in ZIP entry paths.
    # Windows Compress-Archive uses backslashes ('\') which causes Firefox nsZipArchive to reject
    # the archive with: "Invalid file name in archive: assets\favicon.svg"
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $zipStream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::Create)
    $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

    try {
        Get-ChildItem -Path $StageRoot -Recurse -File | Where-Object {
            $_.Name -notmatch '^(\.DS_Store|Thumbs\.db|desktop\.ini|\.git.*)$' -and
            $_.Extension -notmatch '^\.(tmp|bak|log)$'
        } | ForEach-Object {
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
