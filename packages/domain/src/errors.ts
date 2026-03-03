/**
 * Thrown when a requested entity does not exist.
 *
 * Carries a machine-readable `code` of `"NOT_FOUND"` so route handlers
 * can map it to an HTTP 404 response.
 */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when an operation conflicts with the current state of an entity
 * (e.g. promoting an idea that has already been promoted).
 *
 * Carries a machine-readable `code` of `"CONFLICT"` so route handlers
 * can map it to an HTTP 409 response.
 */
export class ConflictError extends Error {
  readonly code = "CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
