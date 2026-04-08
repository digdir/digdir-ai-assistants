type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = "[REDACTED]";
const MAX_LOG_STRING_LENGTH = 2_000;
const MAX_LOG_DEPTH = 6;
const SENSITIVE_KEY_PATTERN =
  /api[-_]?key|token|secret|password|authorization|cookie|session|signing/i;

function normalizeLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function truncateString(value: string): string {
  if (value.length <= MAX_LOG_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_STRING_LENGTH)}…[truncated ${value.length - MAX_LOG_STRING_LENGTH} chars]`;
}

function sanitizeForLogs(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: truncateString(value.stack || ""),
    };
  }

  if (depth >= MAX_LOG_DEPTH) {
    return "[MaxDepthExceeded]";
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeForLogs(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : sanitizeForLogs(nestedValue, depth + 1, seen);
    }

    return result;
  }

  return String(value);
}

class Logger {
  private currentLevel = normalizeLogLevel(process.env.LOG_LEVEL);

  isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.currentLevel];
  }

  debug(message: string, meta?: unknown): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const suffix = meta === undefined ? "" : ` ${JSON.stringify(sanitizeForLogs(meta))}`;
    const line = `[${timestamp}] ${level.toUpperCase()} ${message}${suffix}`;

    if (level === "debug" || level === "info") {
      console.log(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.error(line);
  }
}

export const logger = new Logger();
export const sanitizeForLogsValue = sanitizeForLogs;
