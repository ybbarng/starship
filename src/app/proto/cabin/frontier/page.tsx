import { FrontierCabin } from "@/ui/cabin-protos/frontier/FrontierCabin";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const { crew } = await searchParams;
  return <FrontierCabin crewId={crew ?? "web-shop"} />;
}
