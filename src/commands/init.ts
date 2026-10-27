import { confirm } from '@inquirer/prompts';
import path from 'node:path';
import { ensureDirectories, writeFileIfMissing } from '../utils/fileSystem.js';
import { logger } from '../utils/logger.js';
import { files } from '../templates/index.js';

const baseDirectories = [
  '000_Atlas',
  '100_Spaces/110_Career_Business',
  '100_Spaces/120_Creative_SideHustle',
  '100_Spaces/130_Personal',
  '200_Projects',
  '200_Projects/210_Project_Alpha/Past_Phases_Archive',
  '200_Projects/210_Project_Alpha/Phase_03_Active',
  '200_Projects/220_Project_B',
  '300_Slipbox',
  '400_Journal',
  '999_Templates',
];

export interface InitOptions {
  cwd?: string;
  confirmCurrentDirectory?: () => Promise<boolean>;
  now?: () => Date;
}

export async function initializeVault(
  targetPath: string | undefined,
  options: InitOptions = {},
): Promise<{ created: string[]; skipped: string[] }> {
  const cwd = options.cwd ?? process.cwd();
  const target = path.resolve(cwd, targetPath ?? '.');
  // An explicit path is an affirmative target; only the implicit cwd needs confirmation.
  const currentDirectoryTarget = targetPath === undefined;

  if (currentDirectoryTarget) {
    const confirmed = await (
      options.confirmCurrentDirectory ??
      (() =>
        confirm({
          message: `Initialize ARC structure in ${path.basename(target) || target}?`,
          default: true,
        }))
    )();
    if (!confirmed) {
      logger.info('Initialization cancelled.');
      return { created: [], skipped: [] };
    }
  }

  // Resolve the journal year once so the whole scaffold uses one consistent local date.
  const year = String((options.now ?? (() => new Date()))().getFullYear());
  const directories = [...baseDirectories, path.posix.join('400_Journal', year)];
  await ensureDirectories(target, directories);

  const created: string[] = [];
  const skipped: string[] = [];
  const outputFiles: Record<string, string> = {
    ...files,
    '100_Spaces/110_Career_Business/.gitkeep': '',
    '100_Spaces/120_Creative_SideHustle/.gitkeep': '',
    '100_Spaces/130_Personal/.gitkeep': '',
    '200_Projects/.gitkeep': '',
  };

  for (const [relativePath, contents] of Object.entries(outputFiles)) {
    const result = await writeFileIfMissing(target, relativePath, contents);
    (result.written ? created : skipped).push(result.path);
  }

  for (const relativePath of created) {
    logger.success(`Created ${relativePath}`);
  }
  for (const relativePath of skipped) {
    logger.warning(`Preserved existing ${relativePath}`);
  }
  logger.success(`ARC structure initialized in ${target}`);
  return { created, skipped };
}
