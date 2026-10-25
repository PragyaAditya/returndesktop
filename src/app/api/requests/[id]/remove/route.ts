import { handle } from "@/lib/errors/response";
import { parseRequestId } from "@/lib/validation/requests";
import { removeRequest } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    await removeRequest(parseRequestId(id));
    return new Response(null, { status: 204 });
  });
}
