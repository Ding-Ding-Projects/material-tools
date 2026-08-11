[CmdletBinding()]
param([switch]$Silent)

$ErrorActionPreference = 'Stop'
$startedAt = Get-Date
$projectRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot 'build.ps1') -Silent

Push-Location $projectRoot
try {
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Building the unsigned Squirrel.Windows installer."
    & npm run dist
    if ($LASTEXITCODE -ne 0) { throw "Installer packaging failed with exit code $LASTEXITCODE." }

    $output = Join-Path $projectRoot 'dist\squirrel-windows'
    $setup = Get-ChildItem -LiteralPath $output -Filter '*.exe' -File | Where-Object Name -Match 'Setup|MaterialTools' | Select-Object -First 1
    $releases = Join-Path $output 'RELEASES'
    $package = Get-ChildItem -LiteralPath $output -Filter '*-full.nupkg' -File | Select-Object -First 1
    if (-not $setup -or -not (Test-Path -LiteralPath $releases) -or -not $package) {
        throw 'Installer packaging completed without Setup.exe, RELEASES, or a full .nupkg.'
    }

    if ($PSVersionTable.PSEdition -eq 'Desktop') {
        $securityModule = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1'
        Import-Module $securityModule -Force -ErrorAction Stop
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $setup.FullName -ErrorAction Stop
    if ($signature.Status -ne 'NotSigned') {
        throw "Permanent no-signing policy violated: $($setup.Name) reports $($signature.Status)."
    }

    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $setup.FullName
    $elapsed = (Get-Date) - $startedAt
    Write-Host "Unsigned installer: $($setup.FullName)"
    Write-Host "SHA-256: $($hash.Hash)"
    Write-Host "Full package: $($package.FullName)"
    Write-Host "Release index: $releases"
    Write-Host "Completed in $([math]::Round($elapsed.TotalSeconds, 1)) seconds. Windows may show an unknown-publisher or SmartScreen warning."
} finally {
    Pop-Location
}
