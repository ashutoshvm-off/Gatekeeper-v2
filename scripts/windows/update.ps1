param()
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$administrator = ([Security.Principal.WindowsPrincipal] $identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $administrator) {
    $process = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'))
    exit $process.ExitCode
}

$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$installRoot = Join-Path $env:ProgramFiles 'ASIET-Gatekeeper'
$databaseRoot = Join-Path $env:ProgramData 'ASIET-Gatekeeper'
$node = Join-Path $installRoot 'runtime\node.exe'
$npm = Join-Path $installRoot 'runtime\node_modules\npm\bin\npm-cli.js'
$taskName = 'ASIET Gatekeeper Server'
foreach ($file in @($node, $npm, (Join-Path $databaseRoot 'config.json'), (Join-Path $databaseRoot 'gatekeeper.sqlite'))) {
    if (-not (Test-Path -LiteralPath $file)) { throw 'A complete local installation is required. Use setup.bat for the first installation.' }
}
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$wasEnabled = $task.State -ne 'Disabled'
$wasRunning = $task.State -eq 'Running'
try { $running = Invoke-RestMethod 'http://127.0.0.1:4317/api/config' -TimeoutSec 2 } catch { $running = $null }
if ($running.mode -eq 'cloud') { throw 'Stop the cloud launcher or npm run dev before updating the installed local website.' }

Write-Host 'Before updating, stop scanning, wait for 0 pending taps in every browser, then close the website.'
Write-Host 'Building the new version. The installed website is not changed if the build fails.'
$env:PATH = (Split-Path $node -Parent) + ';' + $env:PATH
$env:VITE_STORAGE_MODE = 'local'
$env:GATEKEEPER_DATABASE = 'sqlite'
$env:GATEKEEPER_DATA_DIR = $databaseRoot
Push-Location -LiteralPath $sourceRoot
try {
    & $node $npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check internet access and retry update.bat.' }
    & $node $npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. The installed application was not changed.' }
} finally { Pop-Location }

function Copy-AppFiles([string] $from, [string] $to, [switch] $ProjectSource) {
    foreach ($part in @('server', 'dist', 'src', 'windows')) {
        $source = Join-Path $from $part
        $destination = Join-Path $to $part
        if ($ProjectSource -and $part -eq 'windows') { $source = Join-Path $from 'scripts\windows' }
        New-Item -ItemType Directory -Force -Path $destination | Out-Null
        if ($ProjectSource -and $part -eq 'src') {
            Copy-Item -LiteralPath (Join-Path $source 'domain.js') -Destination $destination -Force
        } else {
            Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $destination -Recurse -Force
        }
    }
    Copy-Item -LiteralPath (Join-Path $from 'package.json') -Destination $to -Force
}
function Stop-InstalledServer {
    Disable-ScheduledTask -TaskName $taskName | Out-Null
    Stop-ScheduledTask -TaskName $taskName
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ((Get-ScheduledTask -TaskName $taskName).State -ne 'Running') {
            # Wait for the process holding the local HTTP port to finish as well.
            if (-not (Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue)) { return }
        }
        Start-Sleep -Milliseconds 500
    }
    throw 'The local server did not stop. No application files were replaced.'
}
function Wait-InstalledServer {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $config = Invoke-RestMethod 'http://127.0.0.1:4317/api/config' -TimeoutSec 2
            $health = Invoke-RestMethod 'http://127.0.0.1:4317/api/system/status' -TimeoutSec 2
            if ($config.mode -eq 'local' -and $health.app -eq 'asiet-gatekeeper' -and $health.database.status -eq 'connected') { return }
        } catch {}
        Start-Sleep -Seconds 1
    }
    throw 'The updated server did not become healthy. Restoring the previous application files.'
}

$savedApp = Join-Path $installRoot ('app-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
$snapshotReady = $false
$replacing = $false
$serverTouched = $false
try {
    New-Item -ItemType Directory -Path $savedApp -Force | Out-Null
    Copy-AppFiles -from $installRoot -to $savedApp
    $snapshotReady = $true
    $serverTouched = $true
    Stop-InstalledServer
    Write-Host 'Creating a database backup before replacing application files...'
    & $node (Join-Path $installRoot 'server\backup.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Database backup failed. Update cancelled.' }
    $replacing = $true
    Copy-AppFiles -from $sourceRoot -to $installRoot -ProjectSource
    Enable-ScheduledTask -TaskName $taskName | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Wait-InstalledServer
    if (-not $wasEnabled) {
        Stop-InstalledServer
        Write-Host 'Update verified. Automatic server startup remains disabled, as it was before this update.'
    }
} catch {
    $failure = $_
    $restoreOk = $true
    if ($replacing -and $snapshotReady) {
        try {
            Stop-InstalledServer
            Copy-AppFiles -from $savedApp -to $installRoot
            Write-Warning 'Previous application files restored. The current database was not rolled back.'
        } catch { $restoreOk = $false; Write-Warning "Automatic application restore failed. Recovery copy: $savedApp. Error: $($_.Exception.Message)" }
    }
    if ($serverTouched -and $wasEnabled -and $restoreOk) {
        Enable-ScheduledTask -TaskName $taskName | Out-Null
        if ($wasRunning) { Start-ScheduledTask -TaskName $taskName }
    }
    throw $failure
}
Write-Host "Update complete. Previous application files: $savedApp"
Write-Host 'Members, logs, passwords and browser queues were preserved. Turso transfer/cleanup was not run.'
Write-Host 'Close and reopen the website with start.bat from your normal Windows account; sign in again if asked.'
