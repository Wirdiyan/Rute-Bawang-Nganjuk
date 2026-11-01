param([switch]$InstallOnly, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonCandidates = @(
    (Join-Path $PSScriptRoot '.venv\Scripts\python.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
)
$installedPython = Get-Command python.exe -ErrorAction SilentlyContinue
if ($installedPython -and $installedPython.Source -notlike '*WindowsApps*') { $pythonCandidates += $installedPython.Source }
$bootstrapPython = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $bootstrapPython) { throw 'Pasang Python 3.10 atau lebih baru, lalu jalankan kembali.' }
$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    Write-Host 'Menyiapkan lingkungan Python lokal...'
    & $bootstrapPython -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Pembuatan lingkungan Python gagal.' }
}
$probePreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try { & $venvPython -c 'import fastapi, networkx, shapely, uvicorn, httpx' 2>$null; $needsDependencies = $LASTEXITCODE -ne 0 }
finally { $ErrorActionPreference = $probePreference }
if ($needsDependencies) {
    Write-Host 'Memasang dependensi Python. Langkah pertama ini memerlukan internet...'
    & $venvPython -m pip install -r backend/requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Pemasangan dependensi Python gagal.' }
}
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw 'Pasang Node.js 20.19+ atau 22.12+, lalu jalankan kembali.' }
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { throw 'npm tidak ditemukan. Periksa instalasi Node.js.' }
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
    Write-Host 'Memasang dependensi antarmuka...'
    & $npm.Source ci
    if ($LASTEXITCODE -ne 0) { throw 'Pemasangan dependensi antarmuka gagal.' }
}
if ($InstallOnly) { Write-Host 'Dependensi siap.'; exit 0 }
foreach ($port in @(8000,5173)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port sedang digunakan. Hentikan server yang memakai port tersebut lalu jalankan kembali."
    }
}
$logDirectory = Join-Path $PSScriptRoot '.local'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$api = $null; $web = $null
try {
    $api = Start-Process -FilePath $venvPython -ArgumentList @('-m','uvicorn','backend.api.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'api.log') -RedirectStandardError (Join-Path $logDirectory 'api-error.log')
    $env:VITE_API_BASE_URL = 'http://127.0.0.1:8000'
    $web = Start-Process -FilePath $node.Source -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'web.log') -RedirectStandardError (Join-Path $logDirectory 'web-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($api.HasExited -or $web.HasExited) { throw 'Server berhenti. Periksa file log di folder .local.' }
        try {
            $null = Invoke-WebRequest 'http://127.0.0.1:8000/api/health' -UseBasicParsing -TimeoutSec 2
            $null = Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2
            $ready = $true; break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'Server belum siap. Periksa file log di folder .local.' }
    Write-Host ''
    Write-Host 'RouteBawang siap: http://127.0.0.1:5173'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
    Write-Host 'Titik lokasi merupakan referensi simulasi OSM.'
    Write-Host 'Biarkan terminal ini terbuka. Tekan Ctrl+C untuk menghentikan kedua server.'
    while (-not $api.HasExited -and -not $web.HasExited) { Start-Sleep -Seconds 1 }
} finally {
    foreach ($ownedProcess in @($api,$web)) {
        if ($ownedProcess -and -not $ownedProcess.HasExited) { Stop-Process -Id $ownedProcess.Id -ErrorAction SilentlyContinue }
    }
}
