"use client";

// 이 맥의 파일을 "보기"(새 탭)와 "열기"(맥의 맞는 프로그램)로 다루는 단추.
// 책상 카드(DeskPanel)와 조종석 결재함(Inbox)이 함께 쓴다. 검사는 서버가 한다. 설계: docs/files.md.
// md는 날 글 대신 읽기 좋게 그린 화면(/files/view)으로 연다(2026-11-03).
// html·md의 "보기"는 선실 지도 자리(FilePane)에 띄운다(2026-11-17, src/ui/files/paneTarget.tsx).
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/data/toast";
import { useFilePane } from "@/ui/files/paneTarget";
import {
  baseName,
  cabinViewHref,
  fileViewHref,
  paneKind,
} from "@/ui/kit/filePaths";

/** "열기": 서버에 맥의 맞는 프로그램으로 열어 달라고 하고, 결과를 알림으로 보인다. */
export function useOpenFile(path: string) {
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/files/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        note?: string;
      } | null;
      toast(
        body?.note ?? (res.ok ? "열었어요" : "열지 못했어요"),
        body?.ok ? "ok" : "error",
      );
    } catch {
      toast("요청을 보내지 못했어요", "error");
    } finally {
      setBusy(false);
    }
  };
  return { open, busy };
}

const VIEW_CLASS =
  "shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px] text-[#7ce0ff] hover:bg-white/[0.14]";

/**
 * "보기". html·md는 선실이면 그 자리의 지도 자리에(show), 결재함이면 그 승무원 선실의 지도 자리로(crewId) 띄운다.
 * 그 밖의 종류나 띄울 자리가 없는 화면은 새 탭으로 연다(2026-11-17).
 */
function ViewButton({ path }: { path: string }) {
  const pane = useFilePane();
  const kind = paneKind(path);
  if (kind && pane.show) {
    const show = pane.show;
    return (
      <button
        type="button"
        data-file-view
        data-file-pane={kind}
        onClick={() => show(path)}
        title="지도 자리에 띄워요"
        className={VIEW_CLASS}
      >
        보기
      </button>
    );
  }
  if (kind && pane.crewId)
    return (
      <Link
        href={cabinViewHref(pane.crewId, path)}
        data-file-view
        data-file-pane={kind}
        title="선실 지도 자리에 띄워요"
        className={VIEW_CLASS}
      >
        보기 →
      </Link>
    );
  return (
    <a
      href={fileViewHref(path)}
      target="_blank"
      rel="noopener noreferrer"
      data-file-view
      className={VIEW_CLASS}
    >
      보기 ↗
    </a>
  );
}

/**
 * 책상의 path(이 맥의 파일)를 "보기"(새 탭)와 "열기"(맥의 맞는 프로그램)로 다룬다.
 * 허용 폴더·숨김·확장자는 서버가 검사하고, 거절하면 그 까닭을 알림으로 보인다. 설계: docs/files.md.
 */
export function FileButtons({ path }: { path: string }) {
  const { open, busy } = useOpenFile(path);
  // 좁은 현황판(320px)에서는 파일 이름이 줄어들고 단추는 제 크기를 지킨다(2026-11-03)
  return (
    <span
      data-file={path}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap"
    >
      <span
        className="min-w-0 max-w-[14rem] truncate text-[11px] text-white/45"
        title={path}
      >
        {baseName(path)}
      </span>
      <ViewButton path={path} />
      <button
        type="button"
        data-file-open
        disabled={busy}
        onClick={open}
        title="맥에서 맞는 프로그램으로 열어요"
        className="shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px] text-white/80 hover:bg-white/[0.14] disabled:opacity-40"
      >
        열기
      </button>
    </span>
  );
}
