import { handle } from "@/lib/errors/response";
import { parseRequestId, parseTransition, readJson } from "@/lib/validation/requests";
import { transitionRequest } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    const input = parseTransition(await readJson(request));
    return Response.json(await transitionRequest(parseRequestId(id), input));
  });
}
