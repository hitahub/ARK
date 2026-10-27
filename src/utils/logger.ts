import chalk from 'chalk';

// Keep terminal styling and message conventions consistent across CLI commands.
export const logger = {
  success(message: string): void {
    console.log(chalk.green(`✔ ${message}`));
  },
  info(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  },
  warning(message: string): void {
    console.log(chalk.yellow(`! ${message}`));
  },
  error(message: string): void {
    console.error(chalk.red(`✖ ${message}`));
  },
};
