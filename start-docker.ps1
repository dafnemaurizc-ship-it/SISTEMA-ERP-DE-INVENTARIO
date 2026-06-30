Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DockerReady {
    try {
        docker version *> $null
        return $true
    } catch {
        return $false
    }
}

$dockerService = Get-Service com.docker.service -ErrorAction SilentlyContinue
if ($dockerService -and $dockerService.Status -ne "Running" -and -not (Test-Admin)) {
    Write-Host "Docker Desktop Service esta detenido. Solicitando permisos de administrador para iniciarlo..."
    $args = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process -FilePath "powershell.exe" -ArgumentList $args -Verb RunAs
    exit
}

if ($dockerService -and $dockerService.Status -ne "Running") {
    Start-Service com.docker.service
}

$dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerDesktop) {
    if (-not (Test-DockerReady)) {
        Start-Process -FilePath $dockerDesktop
        Write-Host "Iniciando Docker Desktop..."
    }
}

$deadline = (Get-Date).AddMinutes(3)
do {
    $ready = Test-DockerReady
    if (-not $ready) { Start-Sleep -Seconds 3 }
} while (-not $ready -and (Get-Date) -lt $deadline)

if (-not $ready) {
    throw "Docker no esta listo. Abre Docker Desktop, espera que diga 'Engine running' y vuelve a ejecutar este script."
}

docker compose up -d --build

Write-Host ""
Write-Host "Servicios iniciados:"
Write-Host "  Frontend: http://localhost:3000"
Write-Host "  Backend:  http://127.0.0.1:8000"
Write-Host "  Docs:     http://127.0.0.1:8000/docs"
