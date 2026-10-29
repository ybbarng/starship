import { ShipyardCabin } from "@/ui/cabin-protos/shipyard/ShipyardCabin";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const { crew } = await searchParams;
  return <ShipyardCabin crewId={crew ?? "web-shop"} />;
}
