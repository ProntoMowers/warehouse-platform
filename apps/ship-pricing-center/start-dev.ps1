$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

if (!(Test-Path $backendPath)) { throw "No existe: $backendPath" }
if (!(Test-Path $frontendPath)) { throw "No existe: $frontendPath" }

function Start-AppProcess {
    param(
        [Parameter(Mandatory = $true)] [string] $WorkingDirectory,
        [Parameter(Mandatory = $true)] [string] $Command,
        [Parameter(Mandatory = $true)] [string] $Name
    )

    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", $Command `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "[$Name] iniciado. PID=$($proc.Id)" -ForegroundColor Green
    return $proc
}

function Get-PortListener {
    param([Parameter(Mandatory = $true)] [int] $Port)
    return Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq $Port } |
        Select-Object -First 1
}

Write-Host "Iniciando Ship Pricing Center backend y frontend..." -ForegroundColor Cyan

if (Get-PortListener -Port 3012) {
    Write-Warning "Backend ya esta escuchando en 3012. No se inicia otro proceso."
    $backend = $null
} else {
    $backend = Start-AppProcess -WorkingDirectory $backendPath -Command "npm run start" -Name "backend"
}

if (Get-PortListener -Port 5174) {
    Write-Warning "Frontend ya esta escuchando en 5174. No se inicia otro proceso."
    $frontend = $null
} else {
    $frontend = Start-AppProcess -WorkingDirectory $frontendPath -Command "npm run dev -- --host 127.0.0.1 --port 5174" -Name "frontend"
}

Start-Sleep -Seconds 3

$backendPort = Get-PortListener -Port 3012
$frontendPort = Get-PortListener -Port 5174

if ($backendPort) {
    Write-Host "Backend OK  -> http://localhost:3012/api/health" -ForegroundColor Yellow
} else {
    Write-Warning "Backend no esta escuchando en 3012 aun."
}

if ($frontendPort) {
    Write-Host "Frontend OK -> http://localhost:5174" -ForegroundColor Yellow
} else {
    Write-Warning "Frontend no esta escuchando en 5174 aun."
}

Write-Host ""
Write-Host "Para detenerlos luego:" -ForegroundColor Cyan
$startedParents = @($backend, $frontend) | Where-Object { $null -ne $_ } | Select-Object -ExpandProperty Id
$childPids = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ParentProcessId -in $startedParents -and $_.Name -eq "node.exe" } |
    Select-Object -ExpandProperty ProcessId
$allPids = @($startedParents) + @($childPids)
if ($allPids.Count) {
    Write-Host "  Stop-Process -Id $($allPids -join ',') -Force"
} else {
    Write-Host "  Usa Get-NetTCPConnection para identificar el proceso que ya estaba escuchando."
}
