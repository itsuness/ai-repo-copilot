import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level];
  }

  debug(msg: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.debug(chalk.gray(`[debug] ${msg}`), ...args);
    }
  }

  info(msg: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.log(chalk.cyan('ℹ'), msg, ...args);
    }
  }

  success(msg: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.log(chalk.green('✔'), msg, ...args);
    }
  }

  warn(msg: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow('⚠'), chalk.yellow(msg), ...args);
    }
  }

  error(msg: string, ...args: unknown[]) {
    if (this.shouldLog('error')) {
      console.error(chalk.red('✖'), chalk.red(msg), ...args);
    }
  }

  // Prints raw output — for LLM responses rendered to the terminal
  print(msg: string) {
    console.log(msg);
  }
}

export const logger = new Logger();
