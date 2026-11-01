import { getUsage } from "@/server/usage";
import { parseRange } from "@/usage/model";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const range = parseRange(new URL(request.url).searchParams.get("range"));
  try {
    return Response.json(await getUsage(range));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
