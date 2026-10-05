$ErrorActionPreference = 'Stop'
try { $status=Invoke-RestMethod 'http://127.0.0.1:4317/api/system/status' -TimeoutSec 2 } catch { $status=$null }
if ($status.app -ne 'asiet-gatekeeper') {
    $command="Start-ScheduledTask -TaskName 'ASIET Gatekeeper Server'"
    $process=Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-Command',$command)
    if ($process.ExitCode -ne 0) { throw 'Could not start the server task.' }
}
& (Join-Path $PSScriptRoot 'launch.ps1')
