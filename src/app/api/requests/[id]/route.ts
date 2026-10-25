import { handle } from "@/lib/errors/response";
import { parseRequestId, parseUpdateRequest, readJson } from "@/lib/validation/requests";
import { getRequest, updateRequest } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    return Response.json(await getRequest(parseRequestId(id)));
  });
}

export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    const input = parseUpdateRequest(await readJson(request));
    return Response.json(await updateRequest(parseRequestId(id), input));
  });
}
