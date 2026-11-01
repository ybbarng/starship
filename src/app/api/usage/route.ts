import { getUsage } from "@/server/usage";
import { parseRange } from "@/usage/model";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const range = parseRange(q.get("range"));
  try {
    return Response.json(
      await getUsage(range, { fresh: q.get("fresh") === "1" }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
