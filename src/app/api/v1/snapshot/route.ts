import { parseScenario } from "@/demo/scenario";
import { getSnapshot } from "@/server/source";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scenario = parseScenario(params.get("demo"));
  const seat = params.get("seat") ?? "default";
  try {
    return Response.json(await getSnapshot(scenario, seat));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
