param([switch]$Stop,[switch]$NoBrowser)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $projectRoot '.runtime'
$statePath=Join-Path $runtime 'cloud-process.json'
$devScript=Join-Path $PSScriptRoot 'dev.mjs'

function Get-TrackedProcess {
    if(-not (Test-Path -LiteralPath $statePath)){return $null}
    $saved=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $tracked=Get-Process -Id $saved.processId -ErrorAction SilentlyContinue
    if(-not $tracked){return $null}
    if($tracked.Path -ne $saved.executable -or $tracked.StartTime.ToUniversalTime().ToString('o') -ne $saved.startedAt){return $null}
    $details=Get-CimInstance Win32_Process -Filter "ProcessId = $($tracked.Id)"
    if($details.CommandLine -notlike ('*'+$devScript+'*')){throw 'The saved process does not match this project. No process was stopped.'}
    return $tracked
}
function Stop-TrackedProcess {
    $tracked=Get-TrackedProcess
    if($tracked){
        & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $tracked.Id /T /F | Out-Null
        if($LASTEXITCODE -ne 0){throw 'Windows could not stop the tracked cloud process.'}
        Wait-Process -Id $tracked.Id -Timeout 10 -ErrorAction SilentlyContinue
    }
    if(Test-Path -LiteralPath $statePath){Remove-Item -LiteralPath $statePath}
}
function Get-RunningMode {
    try{return (Invoke-RestMethod 'http://127.0.0.1:4317/api/config' -TimeoutSec 2).mode}catch{return $null}
}
function Test-Frontend {
    try{return (Invoke-RestMethod 'http://127.0.0.1:5173/api/config' -TimeoutSec 2).mode -eq 'cloud'}catch{return $false}
}
if($Stop){Stop-TrackedProcess;Write-Host 'Background cloud launcher stopped. A manually started npm run dev must be stopped in its terminal.';exit 0}
$mode=Get-RunningMode
if($mode -eq 'local'){throw 'The installed local database is running. Stop it before using the cloud website.'}
if($mode -eq 'cloud' -and (Test-Frontend)){
    Write-Host 'The cloud website is already running at http://127.0.0.1:5173/.'
    if(-not $NoBrowser){Start-Process 'http://127.0.0.1:5173/'}
    exit 0
}
if(Get-TrackedProcess){Stop-TrackedProcess}
foreach($port in @(4317,5173)){
    if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port is already in use. Stop the previous npm run dev command before launching again."}
}
if(-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/vite/bin/vite.js'))){throw 'Run npm install in the project folder first.'}
$nodePath=(Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$log=Join-Path $runtime 'cloud-output.log'
$errorLog=Join-Path $runtime 'cloud-errors.log'
$child=Start-Process -FilePath $nodePath -ArgumentList @('"'+$devScript+'"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errorLog -PassThru
@{processId=$child.Id;executable=$nodePath;startedAt=$child.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
for($attempt=0;$attempt -lt 30;$attempt++){
    $child.Refresh()
    if($child.HasExited){throw "Website startup stopped. Check $errorLog"}
    if((Get-RunningMode) -eq 'cloud' -and (Test-Frontend)){
        Write-Host 'Cloud website is running independently at http://127.0.0.1:5173/.'
        Write-Host 'You may close this launcher. Use stop-cloud.bat before local setup or to stop the cloud website.'
        if(-not $NoBrowser){Start-Process 'http://127.0.0.1:5173/'}
        exit 0
    }
    Start-Sleep -Milliseconds 500
}
Stop-TrackedProcess
throw "Website did not become ready. Check $errorLog"
