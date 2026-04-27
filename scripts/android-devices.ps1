$ErrorActionPreference = 'Stop'

$localPropsPath = "android/local.properties"
if (-not (Test-Path $localPropsPath)) {
    throw "Arquivo nao encontrado: $localPropsPath"
}

$sdkLine = Get-Content $localPropsPath | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
if (-not $sdkLine) {
    throw "sdk.dir nao encontrado em android/local.properties"
}

$sdkDir = ($sdkLine -replace '^sdk\.dir=', '') -replace '\\\\', '\'
$adbPath = Join-Path $sdkDir "platform-tools/adb.exe"

if (-not (Test-Path $adbPath)) {
    throw "adb.exe nao encontrado em: $adbPath"
}

& $adbPath devices
