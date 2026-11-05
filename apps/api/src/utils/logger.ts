export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...(meta || {}),
      })
    );
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...(meta || {}),
      })
    );
  },
  error: (message: string, err?: unknown, meta?: Record<string, unknown>) => {
    const errorDetails =
      err instanceof Error
        ? { errorName: err.name, errorMessage: err.message, stack: err.stack }
        : err !== undefined
        ? { rawError: String(err) }
        : {};
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...errorDetails,
        ...(meta || {}),
      })
    );
  },
};

