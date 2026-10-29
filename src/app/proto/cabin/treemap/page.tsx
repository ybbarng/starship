import { TreemapCabin } from "@/ui/cabin-protos/treemap/TreemapCabin";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const { crew } = await searchParams;
  return <TreemapCabin crewId={crew ?? "web-shop"} />;
}
