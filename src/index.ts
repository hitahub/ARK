import { createRequire } from 'node:module';
import { Command } from 'commander';
import { initializeVault, type InitOptions } from './commands/init.js';
import { reportVerification, verifyVault } from './commands/verify.js';
import { logger } from './utils/logger.js';

// Read the package version so the --version flag stays aligned with published metadata.
const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

// Injectable command dependencies keep CLI routing testable without filesystem side effects.
export interface CliDependencies {
  initialize?: typeof initializeVault;
  verify?: typeof verifyVault;
  initOptions?: InitOptions;
}

export function createProgram(dependencies: CliDependencies = {}): Command {
  const program = new Command();
  const initialize = dependencies.initialize ?? initializeVault;
  const verify = dependencies.verify ?? verifyVault;

  program
    .name('arc')
    .description('Scaffold and verify an Atomic Rosetta Contextual vault')
    .version(version);

  program
    .command('init')
    .description('Create the ARC vault structure')
    .argument('[path]', 'target vault directory')
    .action(async (targetPath: string | undefined) => {
      await initialize(targetPath, dependencies.initOptions);
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

  return program;
}

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
