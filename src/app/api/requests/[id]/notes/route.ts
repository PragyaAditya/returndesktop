import { handle } from "@/lib/errors/response";
import { parseNote, parseRequestId, readJson } from "@/lib/validation/requests";
import { addNote } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    const input = parseNote(await readJson(request));
    return Response.json(await addNote(parseRequestId(id), input), { status: 201 });
  });
}
