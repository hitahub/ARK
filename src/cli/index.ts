import { Command } from 'commander';
import packageInfo from '../../package.json' with { type: 'json' };
import { initializeVault, type InitOptions } from './commands/init.js';
import { reportVerification, verifyVault } from './commands/verify.js';
import { inspectVaultHealth, reportHealth } from './commands/health.js';
import { updateVault, type UpdateOptions } from './commands/update.js';
import { logger } from './utils/logger.js';

// Read the package version so the --version flag stays aligned with published metadata.
const { version } = packageInfo;

// Injectable command dependencies keep CLI routing testable without filesystem side effects.
export interface CliDependencies {
  initialize?: typeof initializeVault;
  verify?: typeof verifyVault;
  health?: typeof inspectVaultHealth;
  update?: typeof updateVault;
  initOptions?: InitOptions;
  updateOptions?: UpdateOptions;
}

/**
 * Create the ARC command tree, optionally replacing command implementations for tests.
 *
 * @param dependencies Implementations and options injected into registered commands.
 * @returns A Commander program configured with `init`, `verify`, `health`, and `update`.
 */
export function createProgram(dependencies: CliDependencies = {}): Command {
  const program = new Command();
  const initialize = dependencies.initialize ?? initializeVault;
  const verify = dependencies.verify ?? verifyVault;
  const health = dependencies.health ?? inspectVaultHealth;
  const update = dependencies.update ?? updateVault;

  program
    .name('arc')
    .description('Scaffold and verify an Atomic Rosetta Contextual vault')
    .version(version);

  program
    .command('init')
    .description('Create the ARC vault structure')
    .argument('[path]', 'target vault directory')
    .option('--dry-run', 'preview scaffold changes without writing files')
    .action(async (targetPath: string | undefined, commandOptions: { dryRun?: boolean }) => {
      const initOptions = commandOptions.dryRun
        ? { ...dependencies.initOptions, dryRun: true }
        : dependencies.initOptions;
      await initialize(targetPath, initOptions);
    });

  program
    .command('verify')
    .description('Check an ARC vault against the required baseline')
    .argument('[path]', 'vault directory to verify', process.cwd())
    .action(async (targetPath: string) => {
      const result = await verify(targetPath);
      reportVerification(result, targetPath);
      if (!result.valid) {
        process.exitCode = 1;
      }
    });

  program
    .command('health')
    .description('Report broken internal links, orphan notes, and structure issues')
    .argument('[path]', 'vault directory to inspect', process.cwd())
    .action(async (targetPath: string) => {
      const result = await health(targetPath);
      reportHealth(result, targetPath);
      if (!result.healthy) process.exitCode = 1;
    });

  program
    .command('update')
    .description('Preview and safely update ARC scaffold files')
    .argument('[path]', 'vault directory to update', process.cwd())
    .option('--yes', 'apply the preview without prompting')
    .option('--dry-run', 'preview scaffold changes without writing files')
    .action(async (targetPath: string, commandOptions: { yes?: boolean; dryRun?: boolean }) => {
      await update(targetPath, {
        ...dependencies.updateOptions,
        ...(commandOptions.yes ? { yes: true } : {}),
        ...(commandOptions.dryRun ? { dryRun: true } : {}),
      });
    });

  return program;
}

/**
 * Parse and run the ARC CLI, reporting command failures and setting a non-zero exit code.
 *
 * @param argv Process-style argument vector, including the executable and script names.
 * @param dependencies Optional command implementations and options for embedding or tests.
 */
export async function runCli(
  argv = process.argv,
  dependencies: CliDependencies = {},
): Promise<void> {
  try {
    await createProgram(dependencies).parseAsync(argv);
  } catch (error) {
    // Commander and command failures share one user-facing error path and non-zero status.
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    process.exitCode = 1;
  }
}
