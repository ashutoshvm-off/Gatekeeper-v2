param([string]$BrowserUser)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $BrowserUser) { $BrowserUser = $identity.Name }
$administrator = ([Security.Principal.WindowsPrincipal] $identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $administrator) {
    Write-Host 'Setup needs administrator access to install the boot service and protect database files.'
    $process = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-BrowserUser', ('"' + $BrowserUser + '"'))
    exit $process.ExitCode
}

$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$installRoot = Join-Path $env:ProgramFiles 'ASIET-Gatekeeper'
$databaseRoot = Join-Path $env:ProgramData 'ASIET-Gatekeeper'
$runtimeRoot = Join-Path $installRoot 'runtime'
try { $runningConfig = Invoke-RestMethod 'http://127.0.0.1:4317/api/config' -TimeoutSec 2 } catch { $runningConfig = $null }
if ($runningConfig.mode -eq 'cloud') { throw 'Stop npm run dev (Ctrl+C) before installing the local database. Cloud and local modes use the same backend port.' }
$browserPaths = @((Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'), (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'), (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'))
if (-not ($browserPaths | Where-Object { Test-Path -LiteralPath $_ })) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'Install Microsoft Edge or Google Chrome first; neither a browser nor winget was found.' }
    & winget.exe install --id Microsoft.Edge --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed. Install Microsoft Edge and rerun setup.' }
}
New-Item -ItemType Directory -Force -Path $installRoot, $databaseRoot, $runtimeRoot | Out-Null
# Database/config are accessible to the boot service and administrators only.
& icacls.exe $databaseRoot /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect the database directory.' }

$architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$node = Join-Path $runtimeRoot 'node.exe'
if (-not (Test-Path -LiteralPath $node)) {
    Write-Host 'Downloading a private Node.js 24 LTS runtime from nodejs.org...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $versions = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $version = ($versions | Where-Object { $_.version -match '^v24\.' -and $_.lts -and $_.files -contains "win-$architecture-zip" } | Select-Object -First 1).version
    if (-not $version) { throw 'A supported Node.js 24 runtime was not found.' }
    $filename = "node-$version-win-$architecture.zip"
    $archive = Join-Path $runtimeRoot $filename
    Invoke-WebRequest "https://nodejs.org/dist/$version/$filename" -OutFile $archive -UseBasicParsing
    $manifest = (Invoke-WebRequest "https://nodejs.org/dist/$version/SHASUMS256.txt" -UseBasicParsing).Content
    $line = ($manifest -split "`n" | Where-Object { $_.Trim().EndsWith("  $filename") } | Select-Object -First 1)
    if (-not $line) { throw 'The download checksum was not found.' }
    $expected = ($line.Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Node.js checksum verification failed.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $runtimeRoot -Force
    $unpacked = Join-Path $runtimeRoot "node-$version-win-$architecture"
    Get-ChildItem -LiteralPath $unpacked | Copy-Item -Destination $runtimeRoot -Recurse -Force
}
& $node -e "if(process.versions.node.split('.')[0]!=='24')process.exit(1); require('node:sqlite');"
if ($LASTEXITCODE -ne 0) { throw 'Node.js 24 with built-in SQLite is required.' }
$env:PATH = $runtimeRoot + ';' + $env:PATH
$env:VITE_STORAGE_MODE = 'local'
Push-Location -LiteralPath $sourceRoot
try {
    Write-Host 'Installing project dependencies and building the local website...'
    & $node (Join-Path $runtimeRoot 'node_modules\npm\bin\npm-cli.js') ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection.' }
    & $node (Join-Path $runtimeRoot 'node_modules\npm\bin\npm-cli.js') run build
    if ($LASTEXITCODE -ne 0) { throw 'Website build failed.' }
} finally { Pop-Location }

$existing = Get-ScheduledTask -TaskName 'ASIET Gatekeeper Server' -ErrorAction SilentlyContinue
if ($existing) { Disable-ScheduledTask -InputObject $existing | Out-Null; Stop-ScheduledTask -InputObject $existing; Start-Sleep -Seconds 2 }
# Copy only application files. The database and browser profile are never replaced.
foreach ($directory in @('server','dist')) {
    $destination = Join-Path $installRoot $directory
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $sourceRoot $directory) | Copy-Item -Destination $destination -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $installRoot 'src'), (Join-Path $installRoot 'windows') | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRoot 'src\domain.js') -Destination (Join-Path $installRoot 'src\domain.js') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'package.json') -Destination $installRoot -Force
Get-ChildItem -LiteralPath $PSScriptRoot | Copy-Item -Destination (Join-Path $installRoot 'windows') -Force
$env:GATEKEEPER_DATA_DIR = $databaseRoot
function Read-SetupPassword([string] $label) {
    while ($true) {
        $first = Read-Host "$label password (at least 12 characters)" -AsSecureString
        $second = Read-Host 'Confirm password' -AsSecureString
        $a = [Net.NetworkCredential]::new('', $first).Password
        $b = [Net.NetworkCredential]::new('', $second).Password
        if ($a.Length -ge 12 -and $a -ceq $b) { return $a }
        Write-Host 'Passwords must match and contain at least 12 characters.'
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $databaseRoot 'config.json'))) {
    $credentials = @{ guard = (Read-SetupPassword 'Officer SEC-G1-204'); admin = (Read-SetupPassword 'Administrator ADM-ASIET-001') }
    $previousEncoding = $OutputEncoding
    try {
        $OutputEncoding = [Text.UTF8Encoding]::new($false)
        ($credentials | ConvertTo-Json -Compress) | & $node (Join-Path $installRoot 'server\init.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
    } finally { $credentials = $null; $OutputEncoding = $previousEncoding }
} else {
    & $node (Join-Path $installRoot 'server\init.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
}
Write-Host 'Transferring the cloud registry and full history into the local database...'
# Use the source project, where npm dependencies and the server-only .env.server
# live. Cloud secrets are never copied into the installed application's folder.
& $node (Join-Path $sourceRoot 'server\import-cloud.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Cloud transfer did not complete. Local startup remains disabled. Fix the reported issue and rerun setup; existing data is preserved.' }
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$serverAction = New-ScheduledTaskAction -Execute $node -Argument ('"' + (Join-Path $installRoot 'server\run.mjs') + '"') -WorkingDirectory $installRoot
$serverPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'ASIET Gatekeeper Server' -Action $serverAction -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $serverPrincipal -Settings $settings -Force | Out-Null
Enable-ScheduledTask -TaskName 'ASIET Gatekeeper Server' | Out-Null

$windowsUser = $BrowserUser
$browserAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $installRoot 'windows\launch.ps1') + '"') -WorkingDirectory $installRoot
$browserPrincipal = New-ScheduledTaskPrincipal -UserId $windowsUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'ASIET Gatekeeper Fullscreen' -Action $browserAction -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $windowsUser) -Principal $browserPrincipal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'ASIET Gatekeeper Server'
Start-ScheduledTask -TaskName 'ASIET Gatekeeper Fullscreen'
Write-Host "Installed. Database: $databaseRoot\gatekeeper.sqlite"
Write-Host "Website: http://127.0.0.1:4317. Fullscreen opens after $windowsUser signs in."
Write-Host 'Existing records are preserved when setup is rerun. Automatic Windows sign-in is not enabled.'
