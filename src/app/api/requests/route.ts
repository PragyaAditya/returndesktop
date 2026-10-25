import { handle } from "@/lib/errors/response";
import { parseCreateRequest, parseListQuery, readJson } from "@/lib/validation/requests";
import { createRequest, listRequestPage } from "@/server/requests/service";

export async function GET(request: Request) {
  return handle(async () => {
    const query = parseListQuery(new URL(request.url).searchParams);
    return Response.json(await listRequestPage(query));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const input = parseCreateRequest(await readJson(request));
    return Response.json(await createRequest(input), { status: 201 });
  });
}
