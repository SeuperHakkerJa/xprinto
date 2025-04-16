export enum LogLevel {
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    DEBUG = 'DEBUG'
  }
  
  const COLORS = {
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.WARNING]: '\x1b[33m', // Yellow
    [LogLevel.INFO]: '\x1b[36m', // Cyan
    [LogLevel.SUCCESS]: '\x1b[32m', // Green
    [LogLevel.DEBUG]: '\x1b[35m', // Magenta
    RESET: '\x1b[0m' // Reset
  };
  
  let verboseLogging = false;
  
  export function setVerboseLogging(verbose: boolean): void {
    verboseLogging = verbose;
  }
  
  export function log(message: string, level: LogLevel = LogLevel.INFO): void {
    // Only log DEBUG messages if verbose logging is enabled
    if (level === LogLevel.DEBUG && !verboseLogging) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const color = COLORS[level] || COLORS.RESET;
    
    console.log(`${color}[${timestamp}] [${level}] ${message}${COLORS.RESET}`);
  }