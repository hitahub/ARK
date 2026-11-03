import { Command } from 'commander';
import packageInfo from '../../package.json' with { type: 'json' };
import { initializeVault, type InitOptions } from './commands/init.js';
import { reportVerification, verifyVault } from './commands/verify.js';
import { inspectVaultHealth, reportHealth } from './commands/health.js';
import { updateVault, type UpdateOptions } from './commands/update.js';
import { archiveProject, type ArchiveOptions } from './commands/archive.js';
import { installGitHook, uninstallGitHook, type GitHookOptions } from './commands/hook.js';
import { startMcpServer } from './commands/mcp.js';
import { reportLinkSuggestions, suggestRelatedNotes } from './commands/links.js';
import { publishSelectedContent, type PublishOptions } from './commands/publish.js';
import { logger } from './utils/logger.js';

// Read the package version so the --version flag stays aligned with published metadata.
const { version } = packageInfo;

// Injectable command dependencies keep CLI routing testable without filesystem side effects.
export interface CliDependencies {
  initialize?: typeof initializeVault;
  verify?: typeof verifyVault;
  health?: typeof inspectVaultHealth;
  update?: typeof updateVault;
  archive?: typeof archiveProject;
  installHook?: typeof installGitHook;
  uninstallHook?: typeof uninstallGitHook;
  mcp?: typeof startMcpServer;
  suggestLinks?: typeof suggestRelatedNotes;
  publish?: typeof publishSelectedContent;
  initOptions?: InitOptions;
  updateOptions?: UpdateOptions;
  archiveOptions?: ArchiveOptions;
  gitHookOptions?: GitHookOptions;
  publishOptions?: Omit<PublishOptions, 'outputPath'>;
}

/**
 * Create the ARC command tree, optionally replacing command implementations for tests.
 *
 * @param dependencies Implementations and options injected into registered commands.
 * @returns A Commander program configured with the ARC CLI commands.
 */
export function createProgram(dependencies: CliDependencies = {}): Command {
  const program = new Command();
  const initialize = dependencies.initialize ?? initializeVault;
  const verify = dependencies.verify ?? verifyVault;
  const health = dependencies.health ?? inspectVaultHealth;
  const update = dependencies.update ?? updateVault;
  const archive = dependencies.archive ?? archiveProject;
  const installHook = dependencies.installHook ?? installGitHook;
  const uninstallHook = dependencies.uninstallHook ?? uninstallGitHook;
  const mcp = dependencies.mcp ?? startMcpServer;
  const suggestLinks = dependencies.suggestLinks ?? suggestRelatedNotes;
  const publish = dependencies.publish ?? publishSelectedContent;

  program
    .name('arc')
    .description('Scaffold and verify an Atomic Rosetta Contextual vault')
    .version(version);

  program
    .command('init')
    .description('Create the ARC vault structure')
    .argument('[path]', 'target vault directory')
    .option('--dry-run', 'preview scaffold changes without writing files')
    .option('--no-plugin', 'skip installing the ARC Obsidian plugin')
    .action(
      async (
        targetPath: string | undefined,
        commandOptions: { dryRun?: boolean; plugin?: boolean },
      ) => {
        const initOptions =
          commandOptions.dryRun || commandOptions.plugin === false
            ? {
                ...dependencies.initOptions,
                ...(commandOptions.dryRun ? { dryRun: true } : {}),
                ...(commandOptions.plugin === false ? { installPlugin: false } : {}),
              }
            : dependencies.initOptions;
        await initialize(targetPath, initOptions);
      },
    );

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
    .command('mcp')
    .description('Start the opt-in, read-only ARC MCP server')
    .argument('<vault-path>', 'explicit vault directory to expose to MCP tools')
    .action(async (vaultPath: string) => {
      await mcp(vaultPath);
    });

  program
    .command('links')
    .description('Discover likely related Slipbox notes')
    .command('suggest')
    .description('Suggest related direct Slipbox notes without editing them')
    .argument('<vault-path>', 'explicit vault directory to analyze')
    .action(async (vaultPath: string) => {
      const result = await suggestLinks(vaultPath);
      reportLinkSuggestions(result);
    });

  program
    .command('publish')
    .description('Preview and export explicitly selected Markdown content locally')
    .argument('<vault-path>', 'source vault directory')
    .argument('<selection...>', 'vault-relative Markdown files or directories to include')
    .requiredOption('--output <path>', 'new output directory outside the source vault')
    .option(
      '--exclude <path>',
      'vault-relative file or directory to exclude; may be repeated',
      (value: string, previous: string[]) => [...previous, value],
      [],
    )
    .option('--dry-run', 'preview the export without writing files')
    .option('--yes', 'write the reviewed export without prompting')
    .action(
      async (
        vaultPath: string,
        selections: string[],
        commandOptions: { output: string; exclude: string[]; dryRun?: boolean; yes?: boolean },
      ) => {
        await publish(vaultPath, selections, {
          ...dependencies.publishOptions,
          outputPath: commandOptions.output,
          exclude: commandOptions.exclude,
          ...(commandOptions.dryRun ? { dryRun: true } : {}),
          ...(commandOptions.yes ? { yes: true } : {}),
        });
      },
    );

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

  program
    .command('archive')
    .description('Move a completed project into archive storage')
    .argument('<project-name>', 'project folder name under 200_Projects')
    .argument('[path]', 'vault directory', process.cwd())
    .option('--yes', 'archive without prompting')
    .option('--dry-run', 'preview the archive without moving files')
    .action(
      async (
        projectName: string,
        targetPath: string,
        commandOptions: { yes?: boolean; dryRun?: boolean },
      ) => {
        await archive(projectName, targetPath, {
          ...dependencies.archiveOptions,
          ...(commandOptions.yes ? { yes: true } : {}),
          ...(commandOptions.dryRun ? { dryRun: true } : {}),
        });
      },
    );

  const hook = program.command('hook').description('Manage the opt-in ARC Git pre-commit hook');

  hook
    .command('install')
    .description('Preview or install ARC health checks as a pre-commit hook')
    .argument('<vault-path>', 'vault directory to inspect before commits')
    .option('--repo <path>', 'Git repository directory', process.cwd())
    .option('--dry-run', 'preview the hook installation without changing files')
    .action(async (targetPath: string, commandOptions: { repo: string; dryRun?: boolean }) => {
      await installHook(targetPath, {
        ...dependencies.gitHookOptions,
        repoPath: commandOptions.repo,
        ...(commandOptions.dryRun ? { dryRun: true } : {}),
      });
    });

  hook
    .command('uninstall')
    .description('Preview or remove an intact ARC-managed pre-commit hook')
    .option('--repo <path>', 'Git repository directory', process.cwd())
    .option('--dry-run', 'preview hook removal without changing files')
    .action(async (commandOptions: { repo: string; dryRun?: boolean }) => {
      await uninstallHook({
        ...dependencies.gitHookOptions,
        repoPath: commandOptions.repo,
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
