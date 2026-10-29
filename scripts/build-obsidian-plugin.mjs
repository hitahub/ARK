import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const outputDirectory = resolve(root, 'dist/obsidian-plugin');
const pluginSource = resolve(root, 'src/obsidian-plugin');

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve(pluginSource, 'main.ts')],
  bundle: true,
  external: ['obsidian'],
  outfile: resolve(outputDirectory, 'main.js'),
  format: 'cjs',
  target: 'es2018',
});
await Promise.all(
  ['manifest.json', 'styles.css'].map((file) =>
    copyFile(resolve(pluginSource, file), resolve(outputDirectory, file)),
  ),
);

console.log(`Obsidian plugin artifacts written to ${outputDirectory}`);
