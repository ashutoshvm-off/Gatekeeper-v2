param([ValidateSet('Stop','Unregister','Backup')][string]$Action)
$ErrorActionPreference = 'Stop'
$administrator=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $administrator) {
    $p=Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-Action',$Action)
    exit $p.ExitCode
}
if ($Action -eq 'Backup') {
    $installRoot=Split-Path $PSScriptRoot -Parent
    & (Join-Path $installRoot 'runtime\node.exe') (Join-Path $installRoot 'server\backup.mjs')
    exit $LASTEXITCODE
}
$task=Get-ScheduledTask -TaskName 'ASIET Gatekeeper Server' -ErrorAction SilentlyContinue
if ($task) { Stop-ScheduledTask -InputObject $task }
if ($Action -eq 'Unregister') {
    foreach ($name in @('ASIET Gatekeeper Server','ASIET Gatekeeper Fullscreen')) {
        Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false
    }
    Write-Host 'Startup tasks removed. Application, database, backups and pending browser scans preserved.'
} else { Write-Host 'Server stopped until start.bat or the next reboot. Close the fullscreen browser with Alt+F4.' }
