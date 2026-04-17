# Project Verification Script
# Run this to verify the new structure is correct

Write-Host "🔍 Verifying Project Structure..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check root .env
Write-Host "Checking root configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✅ .env exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  .env missing (copy from .env.example)" -ForegroundColor Red
    $allGood = $false
}

# Check frontend structure
Write-Host "`nChecking frontend structure..." -ForegroundColor Yellow
$frontendFiles = @(
    "frontend/package.json",
    "frontend/vite.config.js",
    "frontend/src/App.jsx",
    "frontend/src/main.jsx",
    "frontend/src/components/auth/LoginCard.jsx"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file missing" -ForegroundColor Red
        $allGood = $false
    }
}

# Check backend structure
Write-Host "`nChecking backend structure..." -ForegroundColor Yellow
$backendFiles = @(
    "backend/main.py",
    "backend/requirements.txt"
)

foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file missing" -ForegroundColor Red
        $allGood = $false
    }
}

# Check startup scripts
Write-Host "`nChecking startup scripts..." -ForegroundColor Yellow
$scripts = @(
    "start-all.ps1",
    "start-frontend.ps1",
    "start-backend.ps1"
)

foreach ($script in $scripts) {
    if (Test-Path $script) {
        Write-Host "  ✅ $script" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $script missing" -ForegroundColor Red
        $allGood = $false
    }
}

# Check for old files that should be removed
Write-Host "`nChecking for old files (should not exist)..." -ForegroundColor Yellow
$oldFiles = @(
    "src",
    "public/Logo.png",
    "package.json",
    "vite.config.js",
    "tsconfig.json"
)

$foundOld = $false
foreach ($file in $oldFiles) {
    if (Test-Path $file) {
        Write-Host "  ⚠️  $file still exists (should be in frontend/)" -ForegroundColor Yellow
        $foundOld = $true
    }
}

if (-not $foundOld) {
    Write-Host "  ✅ No old files found" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
if ($allGood -and -not $foundOld) {
    Write-Host "✅ Project structure is correct!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Copy .env.example to .env if not done" -ForegroundColor White
    Write-Host "  2. Set SECRET_KEY in .env" -ForegroundColor White
    Write-Host "  3. Run: .\start-all.ps1" -ForegroundColor White
} else {
    Write-Host "⚠️  Some issues found. Please fix them." -ForegroundColor Red
}
Write-Host "==================================================" -ForegroundColor Cyan
