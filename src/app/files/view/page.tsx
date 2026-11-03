// md 파일 보기 화면: /files/view?path=<경로>. 설계: docs/files.md "md 보기 화면".
// 서버는 주소의 경로로 문서 제목(파일 이름)만 정한다. 파일 내용은 읽지 않는다:
// 화면(MdView)이 브라우저에서 /api/files를 fetch해야 같은 출처 검사(Sec-Fetch-Site)가 그대로 걸린다.
import type { Metadata } from "next";
import { MdView } from "@/ui/files/MdView";
import { baseName } from "@/ui/kit/filePaths";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const pathOf = async (searchParams: Props["searchParams"]) => {
  const v = (await searchParams).path;
  return typeof v === "string" ? v : "";
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const p = await pathOf(searchParams);
  return { title: p ? baseName(p) : "파일 보기" };
}

export default async function FileViewPage({ searchParams }: Props) {
  return <MdView path={await pathOf(searchParams)} />;
}
