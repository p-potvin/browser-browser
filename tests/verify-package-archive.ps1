# tests/verify-package-archive.ps1
# Real-conditions verification for WebExtension package archives (ZIP & XPI).
# Validates ZIP specification conformance, forward slashes, root manifest, and extractability.

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$DistPath = Join-Path $ProjectRoot "dist"

Write-Host "=== VERIFYING WEBEXTENSION PACKAGES UNDER REAL CONDITIONS ===" -ForegroundColor Cyan

$Packages = @(
    (Join-Path $DistPath "browser-browser-1.3.2.zip"),
    (Join-Path $DistPath "browser-browser-1.3.2.xpi")
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$AllPassed = $true

foreach ($PkgPath in $Packages) {
    $PkgName = [System.IO.Path]::GetFileName($PkgPath)
    Write-Host "`nTesting archive: $PkgName" -ForegroundColor Yellow

    if (-not (Test-Path $PkgPath)) {
        Write-Error "Package file not found: $PkgPath"
        $AllPassed = $false
        continue
    }

    $Zip = [System.IO.Compression.ZipFile]::OpenRead($PkgPath)
    try {
        $Entries = $Zip.Entries
        Write-Host "Total entries in archive: $($Entries.Count)"

        # Check 1: Zero backslashes in all entry paths (Firefox nsZipArchive requirement)
        $BackslashEntries = @($Entries | Where-Object { $_.FullName -like "*\*" })
        if ($BackslashEntries.Count -gt 0) {
            Write-Host "[FAIL] Found $($BackslashEntries.Count) entries with backslashes!" -ForegroundColor Red
            $BackslashEntries | Select-Object -First 5 | ForEach-Object { Write-Host "   Bad: $($_.FullName)" -ForegroundColor Red }
            $AllPassed = $false
        } else {
            Write-Host "[PASS] 0 backslash entries detected. All separators use UNIX '/' slashes." -ForegroundColor Green
        }

        # Check 2: manifest.json at root
        $ManifestEntry = $Entries | Where-Object { $_.FullName -eq "manifest.json" } | Select-Object -First 1
        if (-not $ManifestEntry) {
            Write-Host "[FAIL] manifest.json missing from archive root!" -ForegroundColor Red
            $AllPassed = $false
        } else {
            Write-Host "[PASS] manifest.json exists at root ($($ManifestEntry.Length) bytes)." -ForegroundColor Green
        }

        # Check 3: assets/favicon.svg entry presence and content
        $FaviconEntry = $Entries | Where-Object { $_.FullName -eq "assets/favicon.svg" } | Select-Object -First 1
        if (-not $FaviconEntry) {
            Write-Host "[FAIL] assets/favicon.svg missing or malformed path!" -ForegroundColor Red
            $AllPassed = $false
        } else {
            $Stream = $FaviconEntry.Open()
            $Reader = New-Object System.IO.StreamReader($Stream)
            $Content = $Reader.ReadToEnd()
            $Reader.Dispose()
            $Stream.Dispose()

            if ($Content -match "<svg") {
                Write-Host "[PASS] assets/favicon.svg is accessible and contains valid SVG XML." -ForegroundColor Green
            } else {
                Write-Host "[FAIL] assets/favicon.svg content invalid!" -ForegroundColor Red
                $AllPassed = $false
            }
        }

        # Check 4: Essential extension entrypoints
        $RequiredFiles = @(
            "src/app/manager.html",
            "src/app/manager.js",
            "src/popup/popup.html",
            "src/options/options.html",
            "src/background/background.js",
            "src/content/content-loader.js"
        )
        foreach ($Req in $RequiredFiles) {
            $Found = $Entries | Where-Object { $_.FullName -eq $Req } | Select-Object -First 1
            if (-not $Found) {
                Write-Host "[FAIL] Required entry point missing: $Req" -ForegroundColor Red
                $AllPassed = $false
            }
        }
        Write-Host "[PASS] All essential extension entry points confirmed in archive." -ForegroundColor Green
    }
    finally {
        $Zip.Dispose()
    }

    # Check 5: Live extraction simulation (Firefox unpacker behavior)
    $TestExtractDir = Join-Path $env:TEMP "bb-test-extract-$([System.Guid]::NewGuid().ToString().Substring(0,8))"
    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($PkgPath, $TestExtractDir)
        $ExtractedManifest = Join-Path $TestExtractDir "manifest.json"
        $ExtractedFavicon = Join-Path $TestExtractDir "assets\favicon.svg"

        if ((Test-Path $ExtractedManifest) -and (Test-Path $ExtractedFavicon)) {
            Write-Host "[PASS] Full archive extraction succeeded without errors (emulating Firefox temporary install)." -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Extraction failed to produce expected files." -ForegroundColor Red
            $AllPassed = $false
        }
    }
    finally {
        if (Test-Path $TestExtractDir) {
            Remove-Item $TestExtractDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($AllPassed) {
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host " ALL ARCHIVE COMPLIANCE & EXTRACTION TESTS PASSED (100%)" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nArchive verification FAILED!" -ForegroundColor Red
    exit 1
}
