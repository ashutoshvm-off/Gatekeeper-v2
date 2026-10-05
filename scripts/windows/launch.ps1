$ErrorActionPreference = 'Stop'
$url = 'http://127.0.0.1:4317'
$profile = Join-Path $env:LOCALAPPDATA 'ASIET-Gatekeeper\Browser'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$ready = $false
for ($i=0; $i -lt 60; $i++) {
    try { $status = Invoke-RestMethod "$url/api/system/status" -TimeoutSec 2; if ($status.app -eq 'asiet-gatekeeper') { $ready=$true; break } } catch {}
    Start-Sleep -Seconds 2
}
if (-not $ready) { 'Server did not become ready. Run start.bat or inspect Task Scheduler.' | Out-File (Join-Path $profile '..\startup-error.txt'); exit 1 }
$browsers = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe')
)
$browser = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { 'Install Microsoft Edge or Google Chrome, then run start.bat.' | Out-File (Join-Path $profile '..\startup-error.txt'); exit 1 }
# Edge --kiosk uses InPrivate, which discards the queue. Normal fullscreen keeps
# IndexedDB in this dedicated profile across browser exits and Windows restarts.
Start-Process -FilePath $browser -ArgumentList @('--start-fullscreen', '--no-first-run', '--no-default-browser-check', ('--user-data-dir="' + $profile + '"'), $url)
