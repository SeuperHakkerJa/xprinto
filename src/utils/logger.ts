/**
 * Defines the severity levels for log messages.
 */
export enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    SUCCESS = 'SUCCESS'
}

/**
 * ANSI color codes for console output.
 */
const COLORS = {
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.WARN]: '\x1b[33m', // Yellow
    [LogLevel.INFO]: '\x1b[36m', // Cyan
    [LogLevel.DEBUG]: '\x1b[35m', // Magenta
    [LogLevel.SUCCESS]: '\x1b[32m', // Green
    RESET: '\x1b[0m' // Reset color
};

/** Internal flag to control verbose output. */
let isVerbose = false;

/**
 * Sets the logging verbosity.
 * @param verbose If true, DEBUG level messages will be printed.
 */
export function setVerbose(verbose: boolean): void {
    isVerbose = !!verbose; // Ensure boolean value
    if (isVerbose) {
        // Use the log function itself to report verbose status
        log('Verbose logging enabled.', LogLevel.DEBUG);
    }
}

/**
 * Logs a message to the console with appropriate level and color.
 * DEBUG messages are only shown if verbose mode is enabled.
 * @param message The message string to log.
 * @param level The severity level of the message (defaults to INFO).
 */
export function log(message: string, level: LogLevel = LogLevel.INFO): void {
    // Skip DEBUG messages if not in verbose mode
    if (level === LogLevel.DEBUG && !isVerbose) {
        return;
    }

    const timestamp = new Date().toISOString();
    const color = COLORS[level] || COLORS.RESET;
    const reset = COLORS.RESET;

    // Construct the log string with timestamp, level, and message
    const logString = `${color}[${timestamp}] [${level}]${reset} ${message}`;

    // Use console.error for ERROR level, console.warn for WARN, console.log otherwise
    // This ensures logs go to the correct stream (stderr/stdout)
    switch (level) {
        case LogLevel.ERROR:
            console.error(logString);
            break;
        case LogLevel.WARN:
            console.warn(logString);
            break;
        default:
            console.log(logString);
            break;
    }
}

/**
 * A convenient wrapper object for logging functions by level.
 */
export const logger = {
    error: (message: string) => log(message, LogLevel.ERROR),
    warn: (message: string) => log(message, LogLevel.WARN),
    info: (message: string) => log(message, LogLevel.INFO),
    debug: (message: string) => log(message, LogLevel.DEBUG),
    success: (message: string) => log(message, LogLevel.SUCCESS),
    setVerbose: setVerbose,
    /** Checks if verbose logging is currently enabled. */
    isVerbose: (): boolean => isVerbose,
};

