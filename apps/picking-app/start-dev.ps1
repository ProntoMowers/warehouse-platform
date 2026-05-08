$ErrorActionPreference = "Stop"

$root = "c:\inetpub\warehouse-platform\apps\picking-app"
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

Write-Host "Iniciando backend y frontend..." -ForegroundColor Cyan

$backend = Start-AppProcess -WorkingDirectory $backendPath -Command "npm run start" -Name "backend"
$frontend = Start-AppProcess -WorkingDirectory $frontendPath -Command "npm run dev -- --host 127.0.0.1 --port 5173" -Name "frontend"

Start-Sleep -Seconds 3

$backendPort = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 3001 } | Select-Object -First 1
$frontendPort = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 5173 } | Select-Object -First 1

if ($backendPort) {
    Write-Host "Backend OK  -> http://localhost:3001/api/health" -ForegroundColor Yellow
} else {
    Write-Warning "Backend no está escuchando en 3001 aún."
}

if ($frontendPort) {
    Write-Host "Frontend OK -> http://localhost:5173" -ForegroundColor Yellow
    Write-Host "API Status  -> http://localhost:5173/picking/status" -ForegroundColor Yellow
} else {
    Write-Warning "Frontend no está escuchando en 5173 aún."
}

Write-Host ""
Write-Host "Para detenerlos luego:" -ForegroundColor Cyan
Write-Host "  Stop-Process -Id $($backend.Id),$($frontend.Id) -Force"
