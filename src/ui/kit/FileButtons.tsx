"use client";

// 이 맥의 파일을 "보기"(새 탭)와 "열기"(맥의 맞는 프로그램)로 다루는 단추.
// 책상 카드(DeskPanel)와 조종석 결재함(Inbox)이 함께 쓴다. 검사는 서버가 한다. 설계: docs/files.md.
// md는 날 글 대신 읽기 좋게 그린 화면(/files/view)으로 연다(2026-11-03).
import { useState } from "react";
import { useToast } from "@/data/toast";
import { baseName, fileViewHref } from "@/ui/kit/filePaths";

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

/**
 * 책상의 path(이 맥의 파일)를 "보기"(새 탭)와 "열기"(맥의 맞는 프로그램)로 다룬다.
 * 허용 폴더·숨김·확장자는 서버가 검사하고, 거절하면 그 까닭을 알림으로 보인다. 설계: docs/files.md.
 */
export function FileButtons({ path }: { path: string }) {
  const { open, busy } = useOpenFile(path);
  // 좁은 옆판(320px)에서는 파일 이름이 줄어들고 단추는 제 크기를 지킨다(2026-11-03)
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
      <a
        href={fileViewHref(path)}
        target="_blank"
        rel="noopener noreferrer"
        data-file-view
        className="shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px] text-[#7ce0ff] hover:bg-white/[0.14]"
      >
        보기 ↗
      </a>
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
