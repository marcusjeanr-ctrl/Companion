const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const file of ['dist/backend.js', 'dist/frontend.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
const files = fs.readdirSync(__dirname).filter(file => /^test_.*\.cjs$/.test(file)).sort();
for (const file of files) {
    const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', cwd: root });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`All ${files.length} regression suites and both bundle syntax checks passed.`);

