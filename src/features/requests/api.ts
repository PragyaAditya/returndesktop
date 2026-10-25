export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: { path: string; message: string }[] | null;

  constructor(status: number, message: string, code?: string, details?: ApiClientError["details"]) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: ApiClientError["details"] };
  } | null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body?.error?.message ?? "The desk could not complete that request.",
      body?.error?.code,
      body?.error?.details,
    );
  }

  return body as T;
}

export function fieldErrors(error: unknown) {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.details)) {
    return {};
  }

  return Object.fromEntries(error.details.map((issue) => [issue.path, issue.message]));
}
