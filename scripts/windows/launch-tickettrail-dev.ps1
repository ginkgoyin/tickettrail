[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $PSCommandPath
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory '..\..'))
$localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$logDirectory = Join-Path $localAppData 'TicketTrail\logs'
$logPath = Join-Path $logDirectory 'dev-launcher.log'

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-LauncherLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    $timestamp = Get-Date -Format 'o'
    Add-Content -LiteralPath $logPath -Value "$timestamp $Message" -Encoding utf8
}

$mutex = [System.Threading.Mutex]::new($false, 'Local\TicketTrailDevLauncher')
$lockHeld = $false

try {
    try {
        $lockHeld = $mutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        $lockHeld = $true
        Write-LauncherLog 'Recovered an abandoned development-launch mutex.'
    }

    if (-not $lockHeld) {
        Write-LauncherLog 'Launch ignored because TicketTrail development is already running.'
        exit 0
    }

    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot 'package.json') -PathType Leaf)) {
        throw "TicketTrail package.json was not found at '$repositoryRoot'."
    }

    Set-Location -LiteralPath $repositoryRoot
    Write-LauncherLog 'Starting TicketTrail development application.'
    Write-LauncherLog "Repository: $repositoryRoot"
    Write-LauncherLog 'Command: npm.cmd run tauri:dev'

    & npm.cmd run tauri:dev
    $exitCode = $LASTEXITCODE
    Write-LauncherLog "TicketTrail development command exited with code $exitCode."

    if ($exitCode -ne 0) {
        exit $exitCode
    }
}
catch {
    Write-LauncherLog "TicketTrail development launch failed: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($lockHeld) {
        $mutex.ReleaseMutex()
    }

    $mutex.Dispose()
}
