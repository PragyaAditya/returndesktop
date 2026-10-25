export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function invalidJson(message = "Request body must be JSON.") {
  return new ApiError(400, "INVALID_JSON", message);
}

export function validationError(details: unknown, message = "The request is invalid.") {
  return new ApiError(422, "VALIDATION_ERROR", message, details);
}

export function invalidQuery(details: unknown) {
  return new ApiError(422, "INVALID_QUERY", "The query parameters are invalid.", details);
}

export function notFound(message = "Request not found.") {
  return new ApiError(404, "NOT_FOUND", message);
}
