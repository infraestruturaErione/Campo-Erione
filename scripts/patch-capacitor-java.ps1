$ErrorActionPreference = 'Stop'

$files = @(
    "android/app/build.gradle",
    "android/app/capacitor.build.gradle"
)

$capacitorGradleFiles = Get-ChildItem -Path "node_modules/@capacitor" -Recurse -Filter "build.gradle" -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName

$files += $capacitorGradleFiles

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        continue
    }

    $content = Get-Content $file -Raw
    $patched = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
    $patched = $patched -replace "getDefaultProguardFile\('proguard-android\.txt'\)", "getDefaultProguardFile('proguard-android-optimize.txt')"
    Set-Content -Path $file -Value $patched -Encoding ASCII
}

Write-Output "Capacitor compatibility patch applied (Java 21 -> 17, Proguard default updated)."

