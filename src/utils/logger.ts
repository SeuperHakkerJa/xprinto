// Simple console logger with levels and colors

export enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    SUCCESS = 'SUCCESS'
}

const COLORS = {
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.WARN]: '\x1b[33m', // Yellow
    [LogLevel.INFO]: '\x1b[36m', // Cyan
    [LogLevel.DEBUG]: '\x1b[35m', // Magenta
    [LogLevel.SUCCESS]: '\x1b[32m', // Green
    RESET: '\x1b[0m' // Reset color
};

let isVerbose = false;

export function setVerbose(verbose: boolean): void {
    isVerbose = verbose;
    if (isVerbose) {
        log('Verbose logging enabled.', LogLevel.DEBUG);
    }
}

export function log(message: string, level: LogLevel = LogLevel.INFO): void {
    if (level === LogLevel.DEBUG && !isVerbose) {
        return; // Don't log debug messages unless verbose is enabled
    }

    const timestamp = new Date().toISOString();
    const color = COLORS[level] || COLORS.RESET;
    const reset = COLORS.RESET;

    console.log(`${color}[${timestamp}] [${level}]${reset} ${message}`);

    // Optionally add more sophisticated logging here (e.g., to a file)
}

// Convenience functions
export const logger = {
    error: (message: string) => log(message, LogLevel.ERROR),
    warn: (message: string) => log(message, LogLevel.WARN),
    info: (message: string) => log(message, LogLevel.INFO),
    debug: (message: string) => log(message, LogLevel.DEBUG),
    success: (message: string) => log(message, LogLevel.SUCCESS),
    setVerbose: setVerbose
};
