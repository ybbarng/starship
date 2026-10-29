import { FactoryCabin } from "@/ui/cabin-protos/factory/FactoryCabin";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const { crew } = await searchParams;
  return <FactoryCabin crewId={crew ?? "web-shop"} />;
}
