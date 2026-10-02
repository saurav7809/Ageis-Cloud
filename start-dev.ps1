#!/usr/bin/env pwsh
# =================================================================
# AegisCloud — Complete Local Development Startup Script
#
# What this does:
#   1. Starts Docker Desktop if not running
#   2. Starts PostgreSQL + Redis via docker compose
#   3. Compiles & starts Spring Boot control-plane on :8081
#   4. Prints a command to start the web frontend on :5173
#
# Prerequisites:
#   - Docker Desktop installed
#   - Java 17+ (detected automatically)
#   - Node.js 18+ for frontend (start manually)
#
# Usage:
#   .\start-dev.ps1
# =================================================================

$ErrorActionPreference = "Continue"
$Root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$MVN   = "$Root\control-plane\mvnw.cmd"
$WEB   = "$Root\web"

# ── helpers ──────────────────────────────────────────────────────
function Banner($text) {
    Write-Host ""
    Write-Host ("=" * 55) -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ("=" * 55) -ForegroundColor Cyan
}
function Ok($text)   { Write-Host "  ✓ $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  ⚠ $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "  ✗ $text" -ForegroundColor Red }
function Info($text) { Write-Host "  → $text" -ForegroundColor DarkGray }

# ── step 1: docker desktop ───────────────────────────────────────
Banner "Step 1 — Docker Desktop"

$dockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if ($dockerRunning) {
    Ok "Docker Desktop is already running"
} else {
    Warn "Docker Desktop is not running — attempting to start it..."
    $exe = "C:\Users\gaura\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    if (Test-Path $exe) {
        Start-Process $exe
        Info "Waiting up to 90 seconds for Docker to start..."
        for ($i = 5; $i -le 90; $i += 5) {
            Start-Sleep 5
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                Ok "Docker ready after ${i}s"
                $dockerRunning = $true
                break
            }
            Info "  ${i}s elapsed..."
        }
    } else {
        Fail "Docker Desktop not found at expected path."
        Fail "Please start Docker Desktop manually and re-run this script."
        exit 1
    }
}

if (-not $dockerRunning) {
    Fail "Docker Desktop did not become ready in 90s."
    Fail "Please start Docker Desktop manually, then re-run this script."
    exit 1
}

# ── step 2: infrastructure ───────────────────────────────────────
Banner "Step 2 — PostgreSQL + Redis"

Set-Location $Root
docker compose down --remove-orphans 2>&1 | Out-Null
docker compose up -d 2>&1 | Out-Null

Info "Waiting for PostgreSQL healthcheck..."
$healthy = $false
for ($i = 0; $i -le 60; $i += 3) {
    Start-Sleep 3
    $st = (docker inspect aegiscloud-postgres --format "{{.State.Health.Status}}" 2>&1)
    if ($st -eq "healthy") { $healthy = $true; break }
}

if ($healthy) {
    Ok "PostgreSQL is healthy  (jdbc:postgresql://localhost:5432/aegiscloud)"
} else {
    Warn "PostgreSQL may still be starting — continuing anyway"
}

$rs = (docker inspect aegiscloud-redis --format "{{.State.Health.Status}}" 2>&1)
if ($rs -eq "healthy") { Ok "Redis is healthy       (localhost:6379)" }
else { Warn "Redis status: $rs" }

# ── step 3: spring boot control plane ────────────────────────────
Banner "Step 3 — Spring Boot Control Plane (:8081)"

if (-not (Test-Path $MVN)) {
    Fail "mvnw.cmd not found at: $MVN"
    exit 1
}

Set-Location "$Root\control-plane"

# Runs in a new window so logs are visible separately
$args = @(
    "/k",
    "`"$MVN`" spring-boot:run"
)
Start-Process "cmd.exe" -ArgumentList $args
Ok "Control-plane starting in new window..."
Info "API base: http://localhost:8081"
Info "Swagger:  http://localhost:8081/swagger"
Info "Health:   http://localhost:8081/actuator/health"

# ── step 4: summary ──────────────────────────────────────────────
Banner "AegisCloud is Starting"
Set-Location $Root

Write-Host ""
Write-Host "  Services:" -ForegroundColor White
Write-Host "    PostgreSQL  :5432  (aegiscloud / aegiscloud)"
Write-Host "    Redis       :6379  (no auth)"
Write-Host "    Backend     :8081  → http://localhost:8081"
Write-Host "    Frontend    :5173  → http://localhost:5173"
Write-Host ""
Write-Host "  Start the frontend (in a separate terminal):" -ForegroundColor Yellow
Write-Host "    cd $WEB" -ForegroundColor DarkGray
Write-Host "    npm run dev" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  First-time setup:" -ForegroundColor Yellow
Write-Host "    POST http://localhost:8081/api/v1/auth/signup" -ForegroundColor DarkGray
Write-Host "    { `"email`": `"admin@example.com`", `"password`": `"password`", `"organisationName`": `"My Org`" }" -ForegroundColor DarkGray
Write-Host ""
Write-Host ("=" * 55) -ForegroundColor Cyan
