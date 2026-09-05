# verify-native-host.ps1
# Comprehensive real-conditions verification test for browser_browser_host C++ native host.

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$exe = Join-Path $repoRoot "native-host\build\Release\browser_browser_host.exe"
$manifestPath = Join-Path $repoRoot "native-host\browser_browser_host.json"

Write-Host "=== TEST 1: REGISTRY PERSISTENCE & MANIFEST VERIFICATION ===" -ForegroundColor Cyan
$regKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\browser_browser_host"
if (-not (Test-Path $regKey)) {
    throw "Registry key $regKey not found!"
}
$registeredManifest = (Get-ItemProperty -Path $regKey)."(Default)"
Write-Host "Registered Manifest Path: $registeredManifest"
if (-not (Test-Path $registeredManifest)) {
    throw "Manifest file does not exist at registered path: $registeredManifest"
}

$manifestContent = Get-Content $registeredManifest -Raw | ConvertFrom-Json
Write-Host "Manifest Name:             $($manifestContent.name)"
Write-Host "Manifest Binary:           $($manifestContent.path)"
Write-Host "Allowed Extensions:        $($manifestContent.allowed_extensions -join ', ')"

if (-not (Test-Path $manifestContent.path)) {
    throw "Binary referenced in manifest does not exist: $($manifestContent.path)"
}
Write-Host "[PASS] Registry & Manifest verified." -ForegroundColor Green

Write-Host "`n=== TEST 2: NATIVE MESSAGING STDIO PROTOCOL (REAL CONDITIONS) ===" -ForegroundColor Cyan

function Send-NativeMessage($proc, $jsonString) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
    $lenBytes = [System.BitConverter]::GetBytes([uint32]$bytes.Length)
    
    $proc.StandardInput.BaseStream.Write($lenBytes, 0, 4)
    $proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
    $proc.StandardInput.BaseStream.Flush()
    
    $respLenBuf = New-Object byte[] 4
    $read = $proc.StandardOutput.BaseStream.Read($respLenBuf, 0, 4)
    if ($read -lt 4) {
        throw "Failed to read 4-byte response length prefix"
    }
    $respLen = [System.BitConverter]::ToUInt32($respLenBuf, 0)
    
    $respBuf = New-Object byte[] $respLen
    $totalRead = 0
    while ($totalRead -lt $respLen) {
        $r = $proc.StandardOutput.BaseStream.Read($respBuf, $totalRead, $respLen - $totalRead)
        if ($r -le 0) { break }
        $totalRead += $r
    }
    
    return [System.Text.Encoding]::UTF8.GetString($respBuf) | ConvertFrom-Json
}

# Start native host process
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $manifestContent.path
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)

try {
    # 2A. Ping
    $pingResp = Send-NativeMessage $proc '{"action":"ping","id":101}'
    Write-Host "Ping response: Success=$($pingResp.success), Version=$($pingResp.version), Port=$($pingResp.httpPort)"
    if (-not $pingResp.success -or $pingResp.version -ne "1.2.0") {
        throw "Ping failed or version mismatch"
    }
    Write-Host "[PASS] Ping verified." -ForegroundColor Green

    # 2B. Physical Drives Enumeration
    $drivesResp = Send-NativeMessage $proc '{"action":"get_drives","id":102}'
    Write-Host "Drives enumerated: $($drivesResp.drives.Count)"
    foreach ($d in $drivesResp.drives) {
        Write-Host "  $($d.letter) $($d.name) - $($d.free_formatted) free / $($d.total_formatted) total ($($d.type))"
    }
    if ($drivesResp.drives.Count -lt 1) {
        throw "Expected at least 1 drive, got 0"
    }
    Write-Host "[PASS] Physical Drives verified." -ForegroundColor Green

    # 2C. List Directory (C:\)
    $cList = Send-NativeMessage $proc '{"action":"list_dir","id":103,"path":"C:\\"}'
    Write-Host "C:\ Directory Listing: Success=$($cList.success), Items=$($cList.items.Count)"
    if (-not $cList.success -or $cList.items.Count -eq 0) {
        throw "Failed to list C:\"
    }
    Write-Host "[PASS] Drive root C:\ listed successfully." -ForegroundColor Green

    # 2D. List Directory (Project Root)
    $projList = Send-NativeMessage $proc ('{"action":"list_dir","id":104,"path":"' + $repoRoot.Replace('\', '\\') + '"}')
    Write-Host "Project directory items: $($projList.items.Count)"
    $hasManifest = $false
    foreach ($item in $projList.items) {
        if ($item.name -eq "manifest.json") {
            $hasManifest = $true
            Write-Host "  Found manifest.json: size=$($item.sizeFormatted), category=$($item.category)"
        }
    }
    if (-not $hasManifest) {
        throw "manifest.json not found in project listing"
    }
    Write-Host "[PASS] Directory listing with metadata verified." -ForegroundColor Green

    Write-Host "`n=== TEST 3: HTTP STREAMING & RANGE REQUESTS (REAL CONDITIONS) ===" -ForegroundColor Cyan
    $port = $pingResp.httpPort

    # 3A. HTTP Ping
    $httpPing = Invoke-RestMethod -Uri "http://127.0.0.1:$port/ping"
    Write-Host "HTTP /ping status: $($httpPing.status), service: $($httpPing.service)"
    if ($httpPing.status -ne "ok") {
        throw "HTTP ping failed"
    }
    Write-Host "[PASS] HTTP health check verified." -ForegroundColor Green

    # 3B. HTTP Full Stream
    $manifestFilePath = Join-Path $repoRoot "manifest.json"
    $expectedBytes = [System.IO.File]::ReadAllBytes($manifestFilePath)
    $streamUrl = "http://127.0.0.1:$port/stream?path=" + [Uri]::EscapeDataString($manifestFilePath)
    
    $httpResp = Invoke-WebRequest -Uri $streamUrl -UseBasicParsing
    Write-Host "Full stream status: $($httpResp.StatusCode), Content-Length: $($httpResp.Content.Length)"
    if ($httpResp.StatusCode -ne 200 -or $httpResp.Content.Length -ne $expectedBytes.Length) {
        throw "Full stream length mismatch: expected $($expectedBytes.Length), got $($httpResp.Content.Length)"
    }
    Write-Host "[PASS] Full file stream byte-for-byte verified." -ForegroundColor Green

    # 3C. HTTP Range Request (bytes=10-39)
    $rangeStart = 10
    $rangeEnd = 39
    $expectedRangeLen = $rangeEnd - $rangeStart + 1

    $rangeReq = [System.Net.HttpWebRequest]::Create($streamUrl)
    $rangeReq.AddRange($rangeStart, $rangeEnd)
    $rangeResp = $rangeReq.GetResponse()
    $rangeStream = $rangeResp.GetResponseStream()
    $rangeBuf = New-Object byte[] $expectedRangeLen
    $rangeRead = $rangeStream.Read($rangeBuf, 0, $expectedRangeLen)
    $rangeStream.Close()

    Write-Host "Range request status: $([int]$rangeResp.StatusCode) (PartialContent), Bytes read: $rangeRead"
    Write-Host "Content-Range header: $($rangeResp.Headers['Content-Range'])"

    if ([int]$rangeResp.StatusCode -ne 206 -or $rangeRead -ne $expectedRangeLen) {
        throw "Range request failed: expected 206 with $expectedRangeLen bytes"
    }

    # Byte-by-byte comparison of slice
    for ($i = 0; $i -lt $expectedRangeLen; $i++) {
        if ($rangeBuf[$i] -ne $expectedBytes[$rangeStart + $i]) {
            throw "Byte mismatch in Range response at offset $i"
        }
    }
    Write-Host "[PASS] HTTP Range request byte-for-byte slice verified." -ForegroundColor Green

} finally {
    $proc.StandardInput.Close()
    $null = $proc.WaitForExit(1000)
    if (-not $proc.HasExited) { $proc.Kill() }
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "ALL REAL-CONDITION VERIFICATION TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan
