const SENSITIVE_PATTERNS = /^(.*key|.*token|.*secret|.*password|.*authorization)$/i;

export function redactSecrets(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_PATTERNS.test(k)) {
        redacted[k] = "[REDACTED]";
      } else {
        redacted[k] = redactSecrets(v);
      }
    }
    return redacted;
  }

  return value;
}
