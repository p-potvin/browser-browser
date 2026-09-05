# unregister-host.ps1
# Unregisters the browser_browser_host Native Messaging host from Mozilla Firefox.

$regKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\browser_browser_host"

if (Test-Path $regKey) {
    Remove-Item -Path $regKey -Recurse -Force
    Write-Host "Unregistered native host: $regKey removed from Windows Registry." -ForegroundColor Yellow
} else {
    Write-Host "Host $regKey is not currently registered." -ForegroundColor Gray
}
