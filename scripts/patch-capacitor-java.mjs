import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

const explicitFiles = [
    path.join(projectRoot, 'android', 'app', 'build.gradle'),
    path.join(projectRoot, 'android', 'app', 'capacitor.build.gradle'),
];

const capacitorRoot = path.join(projectRoot, 'node_modules', '@capacitor');

const collectGradleFiles = (dir, bucket) => {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectGradleFiles(fullPath, bucket);
            continue;
        }
        if (entry.isFile() && (entry.name === 'build.gradle' || entry.name === 'build.gradle.kts')) {
            bucket.add(fullPath);
        }
    }
};

const files = new Set(explicitFiles);
collectGradleFiles(capacitorRoot, files);

let patchedCount = 0;

for (const file of files) {
    if (!fs.existsSync(file)) {
        continue;
    }

    const original = fs.readFileSync(file, 'utf8');
    const patched = original
        .replaceAll('JavaVersion.VERSION_21', 'JavaVersion.VERSION_17')
        .replaceAll('JvmTarget.JVM_21', 'JvmTarget.JVM_17')
        .replaceAll('jvmTarget = "21"', 'jvmTarget = "17"')
        .replaceAll("jvmTarget = '21'", "jvmTarget = '17'")
        .replaceAll('jvmTarget.set("21")', 'jvmTarget.set("17")')
        .replaceAll("jvmTarget.set('21')", "jvmTarget.set('17')")
        .replaceAll('JavaLanguageVersion.of(21)', 'JavaLanguageVersion.of(17)')
        .replaceAll('jvmToolchain(21)', 'jvmToolchain(17)')
        .replaceAll('kotlin.jvmToolchain(21)', 'kotlin.jvmToolchain(17)')
        .replaceAll("getDefaultProguardFile('proguard-android.txt')", "getDefaultProguardFile('proguard-android-optimize.txt')");

    if (patched !== original) {
        fs.writeFileSync(file, patched, 'utf8');
        patchedCount += 1;
    }
}

console.log(`Capacitor compatibility patch applied to ${patchedCount} file(s).`);
