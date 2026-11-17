import { hqCrewId } from "@/relay/hq";
import { Cabin } from "@/ui/map/Cabin";

/** ?view=<경로>: 결재함의 html·md "보기"가 이 선실 지도 자리에 그 파일을 띄우려고 붙인다(docs/files.md) */
export default async function CrewCabinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  return (
    <Cabin
      crewId={decodeURIComponent(id)}
      hqCrewId={hqCrewId()}
      initialView={typeof view === "string" ? view : undefined}
    />
  );
}
