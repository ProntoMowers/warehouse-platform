param(
    [Parameter(Mandatory = $false)]
    [string] $SourceRoot = "",

    [Parameter(Mandatory = $false)]
    [string] $TargetRoot = "C:\inetpub\warehouse-platform\apps\picking-app",

    [Parameter(Mandatory = $false)]
    [string] $IisFrontendPath = "",

    [Parameter(Mandatory = $false)]
    [string] $IisAppPoolName = "",

    [Parameter(Mandatory = $false)]
    [string] $BackendPm2Name = "picking-app-backend"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
    if ($env:GITHUB_WORKSPACE) {
        $SourceRoot = Join-Path $env:GITHUB_WORKSPACE "apps\picking-app"
    } else {
        throw "Debes indicar -SourceRoot o ejecutar dentro de GitHub Actions (GITHUB_WORKSPACE)."
    }
}

$sourceBackend = Join-Path $SourceRoot "backend"
$sourceFrontendDist = Join-Path $SourceRoot "frontend\dist"
$targetBackend = Join-Path $TargetRoot "backend"
$targetBackendEnv = Join-Path $targetBackend ".env"

if ([string]::IsNullOrWhiteSpace($IisFrontendPath)) {
    $IisFrontendPath = Join-Path $TargetRoot "frontend\dist"
}

Write-Host "SourceRoot  : $SourceRoot"
Write-Host "TargetRoot  : $TargetRoot"
Write-Host "IISPath     : $IisFrontendPath"
Write-Host "BackendName : $BackendPm2Name"

if (!(Test-Path $sourceBackend)) { throw "No existe source backend: $sourceBackend" }
if (!(Test-Path $sourceFrontendDist)) { throw "No existe build frontend: $sourceFrontendDist" }
if (!(Test-Path $targetBackendEnv)) { throw "No existe .env de producción en: $targetBackendEnv" }

# 1) Backend sync
Write-Host "Sincronizando backend..."
robocopy $sourceBackend $targetBackend /E /R:2 /W:2 /XD node_modules /XF .env .env.example > $null
if ($LASTEXITCODE -gt 7) { throw "Robocopy backend falló con código $LASTEXITCODE" }

Push-Location $targetBackend
Write-Host "Instalando dependencias de producción backend..."
npm ci --omit=dev
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "npm ci backend falló"
}

Write-Host "Reiniciando PM2 ($BackendPm2Name)..."
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Exists) {
    Pop-Location
    throw "pm2 no está instalado en el servidor. Instala PM2 globalmente."
}

pm2 describe $BackendPm2Name > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    pm2 restart $BackendPm2Name
} else {
    pm2 start src/server.js --name $BackendPm2Name
}
pm2 save
Pop-Location

# 2) Frontend dist sync
Write-Host "Sincronizando frontend dist a IIS..."
if (!(Test-Path $IisFrontendPath)) {
    New-Item -ItemType Directory -Path $IisFrontendPath -Force | Out-Null
}

robocopy $sourceFrontendDist $IisFrontendPath /MIR /R:2 /W:2 > $null
if ($LASTEXITCODE -gt 7) { throw "Robocopy frontend dist falló con código $LASTEXITCODE" }

if (-not [string]::IsNullOrWhiteSpace($IisAppPoolName)) {
    Write-Host "Reciclando App Pool IIS ($IisAppPoolName)..."
    Import-Module WebAdministration
    Restart-WebAppPool -Name $IisAppPoolName
}

Write-Host "Deploy completado correctamente."
Write-Host "Backend : http://localhost:3001/api/health"
Write-Host "Frontend (IIS): $IisFrontendPath"
