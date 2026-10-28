import { Cabin } from "@/ui/map/Cabin";

export default async function CrewCabinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Cabin crewId={decodeURIComponent(id)} />;
}
