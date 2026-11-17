// `npm test`: tests/*.test.ts dosyalarını esbuild ile paketleyip node ile çalıştırır.
// Alias: `@` → src. Herhangi bir test başarısız olursa çıkış kodu 1.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'tests');
const out = path.join(tmpdir(), `gymcime-tests-${process.pid}`);
mkdirSync(out, { recursive: true });

const only = process.argv.slice(2);
const files = readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts') && (only.length === 0 || only.some((o) => f.includes(o))))
  .sort();

const failed = [];
for (const f of files) {
  const outfile = path.join(out, f.replace(/\.ts$/, '.mjs'));
  process.stdout.write(`\n▶ ${f}\n`);
  try {
    await build({
      entryPoints: [path.join(testsDir, f)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'error',
      alias: { '@': path.join(root, 'src'), '@anthropic-ai/sdk': path.join(root, 'node_modules/@anthropic-ai/sdk') },
      external: ['expo-sqlite', 'node:sqlite'],
      loader: { '.jpg': 'empty', '.png': 'empty' },
      banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
    });
  } catch {
    failed.push(`${f} (derleme hatası)`);
    continue;
  }
  const r = spawnSync(process.execPath, ['--no-warnings', outfile], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) failed.push(f);
}
rmSync(out, { recursive: true, force: true });

console.log(`\n${files.length - failed.length}/${files.length} test dosyası geçti`);
if (failed.length) {
  console.error('BAŞARISIZ:\n  ' + failed.join('\n  '));
  process.exit(1);
}
