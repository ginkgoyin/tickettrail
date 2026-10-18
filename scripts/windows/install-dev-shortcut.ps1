[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $PSCommandPath
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory '..\..'))
$launcherPath = Join-Path $scriptDirectory 'launch-tickettrail-dev.ps1'
$iconPath = Join-Path $repositoryRoot 'src-tauri\icons\icon.ico'
$desktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
$shortcutPath = Join-Path $desktopPath 'TicketTrail Dev.lnk'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    throw "TicketTrail development launcher was not found at '$launcherPath'."
}

if (-not (Test-Path -LiteralPath $iconPath -PathType Leaf)) {
    throw "TicketTrail icon was not found at '$iconPath'."
}

if (-not (Test-Path -LiteralPath $powershellPath -PathType Leaf)) {
    throw "Windows PowerShell was not found at '$powershellPath'."
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $null

try {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $powershellPath
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""
    $shortcut.WorkingDirectory = $repositoryRoot
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Launch the TicketTrail development application.'
    $shortcut.Save()
}
finally {
    if ($null -ne $shortcut) {
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)
    }

    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}

Write-Output "Created or updated TicketTrail Dev shortcut: $shortcutPath"
