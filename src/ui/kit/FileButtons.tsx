"use client";

// 이 맥의 파일을 "보기"(새 탭, /api/files)와 "열기"(맥의 맞는 프로그램)로 다루는 단추.
// 책상 카드(DeskPanel)와 조종석 결재함(Inbox)이 함께 쓴다. 검사는 서버가 한다. 설계: docs/files.md.
import { useState } from "react";
import { useToast } from "@/data/toast";

/** 파일 이름(경로 마지막 조각). 단추 옆에 작게 보여 어떤 파일인지 알린다. */
function baseName(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

/**
 * 책상의 path(이 맥의 파일)를 "보기"(새 탭, /api/files)와 "열기"(맥의 맞는 프로그램)로 다룬다.
 * 허용 폴더·숨김·확장자는 서버가 검사하고, 거절하면 그 까닭을 알림으로 보인다. 설계: docs/files.md.
 */
export function FileButtons({ path }: { path: string }) {
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
  return (
    <span
      data-file={path}
      className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap"
    >
      <span
        className="min-w-0 max-w-[14rem] truncate text-[11px] text-white/45"
        title={path}
      >
        {baseName(path)}
      </span>
      <a
        href={`/api/files?path=${encodeURIComponent(path)}`}
        target="_blank"
        rel="noopener noreferrer"
        data-file-view
        className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px] text-[#7ce0ff] hover:bg-white/[0.14]"
      >
        보기 ↗
      </a>
      <button
        type="button"
        data-file-open
        disabled={busy}
        onClick={open}
        title="맥에서 맞는 프로그램으로 열어요"
        className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px] text-white/80 hover:bg-white/[0.14] disabled:opacity-40"
      >
        열기
      </button>
    </span>
  );
}
