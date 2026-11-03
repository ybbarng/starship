import { getCrewMapHistory } from "@/server/source";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const seat = new URL(request.url).searchParams.get("seat") ?? "default";
  try {
    return Response.json(await getCrewMapHistory(id, seat));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
