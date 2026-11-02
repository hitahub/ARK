import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const outputDirectory = resolve(root, 'dist/obsidian-plugin');
const pluginSource = resolve(root, 'src/obsidian-plugin');
const packageInfo = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(pluginSource, 'manifest.json'), 'utf8'));
if (typeof packageInfo.version !== 'string' || packageInfo.version.length === 0) {
  throw new Error('package.json must provide a non-empty version for the plugin manifest.');
}

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve(pluginSource, 'main.ts')],
  bundle: true,
  external: ['obsidian'],
  outfile: resolve(outputDirectory, 'main.js'),
  format: 'cjs',
  target: 'es2018',
});
manifest.version = packageInfo.version;
await Promise.all([
  copyFile(resolve(pluginSource, 'styles.css'), resolve(outputDirectory, 'styles.css')),
  writeFile(
    resolve(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  ),
]);

console.log(`Obsidian plugin artifacts written to ${outputDirectory}`);
