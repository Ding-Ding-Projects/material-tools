[CmdletBinding()]
param([switch]$Silent)

$ErrorActionPreference = 'Stop'
$startedAt = Get-Date
$projectRoot = Split-Path -Parent $PSScriptRoot

function Write-Phase([string]$Message) {
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $Message"
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Ensure-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $major = [int]((& node --version).TrimStart('v').Split('.')[0])
        if ($major -ge 22 -and $major -lt 27) {
            Write-Phase "Found Node.js $(& node --version) at $($node.Source)."
            return
        }
        Write-Phase "Node.js $(& node --version) is outside the supported >=22 <27 range; installing a compatible LTS alongside it."
    } else {
        Write-Phase 'Node.js is missing; installing the current LTS release for the user.'
    }

    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw 'Missing dependency: Node.js >=22 <27. Tried the existing PATH and Windows Package Manager, but winget is unavailable.'
    }

    & winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements --scope user
    if ($LASTEXITCODE -ne 0) {
        throw "Missing dependency: Node.js >=22 <27. winget exited with code $LASTEXITCODE while installing OpenJS.NodeJS.LTS."
    }
    Refresh-ProcessPath
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js installation completed but node is still unavailable after refreshing PATH.'
    }
}

Push-Location $projectRoot
try {
    Ensure-Node
    Write-Phase 'Restoring exact npm dependencies from package-lock.json.'
    if (Test-Path -LiteralPath (Join-Path $projectRoot 'package-lock.json')) {
        & npm ci --no-audit --no-fund
    } else {
        & npm install --no-audit --no-fund
    }
    if ($LASTEXITCODE -ne 0) { throw "npm dependency restore failed with exit code $LASTEXITCODE." }

    Write-Phase 'Building the main process, preload bridge, and renderer.'
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Application build failed with exit code $LASTEXITCODE." }

    $mainEntry = Join-Path $projectRoot 'dist-electron\main.js'
    $rendererEntry = Join-Path $projectRoot 'dist\renderer\index.html'
    if (-not (Test-Path -LiteralPath $mainEntry) -or -not (Test-Path -LiteralPath $rendererEntry)) {
        throw 'Build reported success but required runtime entries are missing.'
    }

    $elapsed = (Get-Date) - $startedAt
    Write-Phase "Build completed in $([math]::Round($elapsed.TotalSeconds, 1)) seconds."
    if (-not $Silent) {
        $answer = Read-Host 'Run Material Tools now? [y/N]'
        if ($answer -match '^(y|yes)$') {
            Write-Phase 'Launching the built application.'
            & npm run start:built
        }
    }
} finally {
    Pop-Location
}
