$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$scriptFile = Join-Path $projectRoot 'scripts\windows\update.ps1'
$tokens = $null; $parseErrors = $null
$null = [Management.Automation.Language.Parser]::ParseFile($scriptFile, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$scriptText = Get-Content -LiteralPath $scriptFile -Raw
# Exercise the actual update lifecycle and file-copy routines in a temporary
# installation. Only elevation/path discovery, npm, HTTP and Task Scheduler are
# replaced; no real installation, service, or cloud database is used.
$body = $scriptText.Substring($scriptText.IndexOf('$task = Get-ScheduledTask'))
$body = $body.Replace('& $node', 'Invoke-TestNode')
if ($body -match 'Register-ScheduledTask|import-cloud|init\.mjs') { throw 'Updater must not reinstall tasks or rerun migration.' }

function Assert-Equal($actual, $expected, [string] $message) {
    if ($actual -cne $expected) { throw "$message. Expected [$expected], got [$actual]" }
}
function Get-ScheduledTask { param($TaskName) [pscustomobject]@{ State = $script:taskState } }
function Disable-ScheduledTask { param($TaskName) $script:taskEnabled = $false }
function Enable-ScheduledTask { param($TaskName) $script:taskEnabled = $true }
function Stop-ScheduledTask { param($TaskName) $script:taskState = 'Ready' }
function Start-ScheduledTask { param($TaskName) $script:taskState = 'Running'; $script:startCount++ }
function Get-NetTCPConnection { param($LocalPort, [switch]$State, $ErrorAction) }
function Start-Sleep { param($Seconds, $Milliseconds) }
function Invoke-RestMethod {
    param([string]$Uri, $TimeoutSec)
    if ($Uri.EndsWith('/api/config')) { return [pscustomobject]@{ mode = 'local' } }
    if ($script:scenario -eq 'unhealthy' -and $script:startCount -eq 1) { throw 'Simulated unhealthy new server' }
    return [pscustomobject]@{ app = 'asiet-gatekeeper'; database = [pscustomobject]@{ status = 'connected' } }
}
function Invoke-TestNode {
    param([Parameter(ValueFromRemainingArguments=$true)][object[]] $Arguments)
    $global:LASTEXITCODE = 0
    if ($Arguments -contains 'ci' -and $script:scenario -eq 'build-failed') { $global:LASTEXITCODE = 1 }
    if ([string]$Arguments[0] -like '*backup.mjs') {
        $script:backupCount++
        if ($script:scenario -eq 'backup-failed') { $global:LASTEXITCODE = 1 }
    }
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('gatekeeper-update-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
try {
    foreach ($case in @('success', 'build-failed', 'backup-failed', 'unhealthy')) {
        $script:scenario = $case; $script:taskState = 'Running'; $script:taskEnabled = $true
        $script:startCount = 0; $script:backupCount = 0
        $sourceRoot = Join-Path $tempRoot "$case\source"
        $installRoot = Join-Path $tempRoot "$case\installed"
        $databaseRoot = Join-Path $tempRoot "$case\data"
        $node = Join-Path $installRoot 'runtime\node.exe'
        $npm = Join-Path $installRoot 'runtime\npm-cli.js'
        $taskName = 'TEST ONLY'
        New-Item -ItemType Directory -Path $databaseRoot -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $databaseRoot 'gatekeeper.sqlite') -Value 'preserve-students-and-history'
        Set-Content -LiteralPath (Join-Path $databaseRoot 'config.json') -Value 'preserve-passwords'
        foreach ($base in @($sourceRoot, $installRoot)) {
            $version = if ($base -eq $sourceRoot) { 'new' } else { 'old' }
            foreach ($part in @('server', 'src', 'dist', 'windows', 'scripts\windows', 'runtime')) {
                New-Item -ItemType Directory -Path (Join-Path $base $part) -Force | Out-Null
            }
            foreach ($file in @('server\index.mjs', 'server\backup.mjs', 'src\domain.js', 'dist\index.html', 'windows\start.ps1', 'scripts\windows\start.ps1', 'package.json')) {
                Set-Content -LiteralPath (Join-Path $base $file) -Value $version
            }
        }
        Set-Content -LiteralPath (Join-Path $sourceRoot '.env.server') -Value 'must-never-be-copied'
        $failed = $false
        try { & ([scriptblock]::Create($body)) } catch { $failed = $true; Write-Host "$case expected failure: $($_.Exception.Message)" }
        Assert-Equal $failed ($case -ne 'success') "$case result"
        $expectedVersion = if ($case -eq 'success') { 'new' } else { 'old' }
        foreach ($file in @('server\index.mjs', 'src\domain.js', 'dist\index.html', 'windows\start.ps1', 'package.json')) {
            Assert-Equal (Get-Content -LiteralPath (Join-Path $installRoot $file) -Raw).Trim() $expectedVersion "$case $file"
        }
        Assert-Equal (Get-Content -LiteralPath (Join-Path $databaseRoot 'gatekeeper.sqlite') -Raw).Trim() 'preserve-students-and-history' "$case database preserved"
        Assert-Equal (Get-Content -LiteralPath (Join-Path $databaseRoot 'config.json') -Raw).Trim() 'preserve-passwords' "$case passwords preserved"
        Assert-Equal (Test-Path -LiteralPath (Join-Path $installRoot '.env.server')) $false "$case secrets not copied"
        Assert-Equal $script:taskEnabled $true "$case startup enabled"
        Assert-Equal $script:taskState 'Running' "$case server restored/running"
        Write-Host "PASS: $case"
    }
} finally {
    $resolved = [IO.Path]::GetFullPath($tempRoot)
    $allowed = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\gatekeeper-update-test-'
    if (-not $resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary cleanup target' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
