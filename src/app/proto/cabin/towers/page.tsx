import { TowersCabin } from "@/ui/cabin-protos/towers/TowersCabin";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const { crew } = await searchParams;
  return <TowersCabin crewId={crew ?? "web-shop"} />;
}
