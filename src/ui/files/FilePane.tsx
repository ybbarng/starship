"use client";

// 선실 지도 자리에 띄운 파일 하나(2026-11-17 사용자 요청: 설명 html을 새 탭 대신 대시보드 안에서).
// 위 줄: 파일 이름 · 새 탭으로 · 지도로 돌아가기(Esc). 설계: docs/files.md "지도 자리에 띄우기".
// 보안: html은 믿을 수 없는 내용이다. iframe에 sandbox="allow-scripts"만 준다.
//   allow-same-origin이 없어 출처가 없는(opaque) 문서가 되고, 부모 화면·이 앱의 API·저장소에 닿지 못한다.
//   allow-top-navigation·allow-popups·allow-forms도 주지 않는다. 서버도 같은 CSP sandbox를 붙인다(src/server/files.ts).
// md는 이 앱 자신의 화면(/files/view, md 속 HTML은 그리지 않는다)을 띄운다. 그 화면이 /api/files를 fetch해야 해서 가두지 않는다.
import { useEffect } from "react";
import { baseName, fileViewHref, paneKind } from "@/ui/kit/filePaths";

export function FilePane({
  path,
  onClose,
  closeLabel = "지도로 돌아가기",
}: {
  path: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  const kind = paneKind(path);
  const src = fileViewHref(path);

  // Esc로 돌아간다. 다른 창(모달 등)이 먼저 받은 Esc는 건드리지 않는다.
  // iframe 안을 누른 뒤에는 키가 iframe으로 가서 여기 닿지 않는다(가둔 html은 부모에 키를 넘길 수 없다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      data-file-pane-view={kind ?? "other"}
      data-file-pane-path={path}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.09] bg-hull-950"
    >
      <header className="flex items-center gap-3 border-b border-white/[0.07] px-3 py-2">
        <span
          data-file-pane-name
          className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90"
          title={path}
        >
          {baseName(path)}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          data-file-pane-tab
          className="shrink-0 text-[11.5px] text-white/45 hover:text-white/80 hover:underline"
        >
          새 탭으로 ↗
        </a>
        <button
          type="button"
          data-file-pane-close
          onClick={onClose}
          title="Esc"
          className="shrink-0 rounded bg-white/[0.08] px-2 py-1 text-[12px] text-white/85 hover:bg-white/[0.14]"
        >
          ← {closeLabel}
        </button>
      </header>
      {kind === "html" ? (
        <iframe
          key={path}
          title={baseName(path)}
          src={src}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          data-file-pane-frame="html"
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : (
        <iframe
          key={path}
          title={baseName(path)}
          src={src}
          referrerPolicy="no-referrer"
          data-file-pane-frame="md"
          className="min-h-0 w-full flex-1 bg-hull-950"
        />
      )}
    </section>
  );
}
