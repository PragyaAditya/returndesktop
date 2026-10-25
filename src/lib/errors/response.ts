import { ApiError } from "./api-error";

export type ErrorBody = {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
};

export function errorBody(code: string, message: string, details: unknown = null): ErrorBody {
  return { error: { code, message, details } };
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(errorBody(error.code, error.message, error.details), {
      status: error.status,
    });
  }

  console.error(error);
  return Response.json(errorBody("INTERNAL_ERROR", "Unexpected server error."), {
    status: 500,
  });
}

export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    return toErrorResponse(error);
  }
}
