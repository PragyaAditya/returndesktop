import { handle } from "@/lib/errors/response";
import { parseRequestId } from "@/lib/validation/requests";
import { getRequest } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    return Response.json(await getRequest(parseRequestId(id)));
  });
}
