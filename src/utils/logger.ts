import chalk from 'chalk';

// Keep terminal styling and message conventions consistent across CLI commands.
/** Styled output helpers for the CLI's success, information, warning, and error messages. */
export const logger = {
  /** Print a success message to stdout. */
  success(message: string): void {
    console.log(chalk.green(`✔ ${message}`));
  },
  /** Print an informational message to stdout. */
  info(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  },
  /** Print a warning message to stdout. */
  warning(message: string): void {
    console.log(chalk.yellow(`! ${message}`));
  },
  /** Print an error message to stderr. */
  error(message: string): void {
    console.error(chalk.red(`✖ ${message}`));
  },
};
