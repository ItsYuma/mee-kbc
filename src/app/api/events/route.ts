import { dispatch } from "@/server/store";
import { parseBody, signalInput } from "@/server/parse";

export async function POST(req: Request) {
  const body = await parseBody(req, signalInput);
  if (!body.ok) return body.res;
  return Response.json(dispatch({ kind: "signal", signal: body.data }));
}
