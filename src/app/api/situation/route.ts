import { dispatch } from "@/server/store";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(dispatch({ kind: "tick" }));
}
