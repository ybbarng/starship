import { parseScenario } from "@/demo/scenario";
import { getSnapshot } from "@/server/source";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const scenario = parseScenario(new URL(request.url).searchParams.get("demo"));
  try {
    return Response.json(await getSnapshot(scenario));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
