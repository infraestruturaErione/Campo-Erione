$ErrorActionPreference = 'Stop'

$files = @(
    "android/app/capacitor.build.gradle",
    "node_modules/@capacitor/android/capacitor/build.gradle"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        continue
    }

    $content = Get-Content $file -Raw
    $patched = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
    Set-Content -Path $file -Value $patched -Encoding ASCII
}

Write-Output "Capacitor Java compatibility patch applied (21 -> 17)."

