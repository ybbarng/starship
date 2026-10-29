import { RoomsCabin } from "@/ui/cabin-protos/rooms/RoomsCabin";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const { crew } = await searchParams;
  return <RoomsCabin crewId={crew ?? "web-shop"} />;
}
