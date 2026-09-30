import { dispatch } from "@/server/store";
import { actionInput, parseBody } from "@/server/parse";

export async function POST(req: Request) {
  const body = await parseBody(req, actionInput);
  if (!body.ok) return body.res;
  return Response.json(dispatch(body.data));
}
