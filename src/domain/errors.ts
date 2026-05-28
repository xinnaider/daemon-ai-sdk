export class DaemonError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "DaemonError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function badRequest(message: string): DaemonError {
  return new DaemonError(message, "BAD_REQUEST", 400);
}

export function notFound(message: string): DaemonError {
  return new DaemonError(message, "NOT_FOUND", 404);
}

export function providerFailure(message: string, provider?: string): DaemonError {
  const prefix = provider ? `[${provider}] ` : "";
  return new DaemonError(`${prefix}${message}`, "PROVIDER_FAILURE", 502);
}

export function permissionFailure(message: string): DaemonError {
  return new DaemonError(message, "PERMISSION_FAILURE", 403);
}
