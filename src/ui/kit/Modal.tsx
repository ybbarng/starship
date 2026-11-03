"use client";

// 화면 위에 띄웠다 닫는 창. Esc나 바깥을 누르면 닫힌다.
// 열면 창 안으로 포커스를 옮기고 Tab은 창 안에서만 돈다. 닫으면 창을 연 요소로 포커스를 돌려준다.
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { FOCUSABLE, wrapFocus } from "./focusTrap";

/** 창 안에서 지금 포커스 받을 수 있는 요소(보이는 것만) */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 열 때 포커스를 안으로, 닫을 때 연 요소로. onClose가 그릴 때마다 바뀌어도 다시 돌지 않게 open에만 건다.
  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // 내용 안에 autoFocus한 것이 있으면 그대로 두고, 없으면 내용의 첫 조작 요소, 그것도 없으면 닫기 단추
    if (!panel.current?.contains(document.activeElement)) {
      const first = body.current ? focusables(body.current)[0] : undefined;
      (first ?? close.current)?.focus();
    }
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const onTab = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const list = focusables(panel.current);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = wrapFocus(at, list.length, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    list[next]?.focus();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={onTab}
    >
      <div
        ref={panel}
        className={`relative max-h-[85vh] w-full overflow-auto rounded-2xl border border-white/15 bg-hull-900/95 p-5 text-white shadow-2xl ${className}`}
        style={{ maxWidth: width }}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div id={titleId} className="text-lg font-semibold">
            {title}
          </div>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div ref={body}>{children}</div>
      </div>
    </div>
  );
}
