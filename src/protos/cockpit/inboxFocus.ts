"use client";

// 결재함 포커스 도우미: 처리 뒤 이어서 볼 서류, J/K로 옮길 서류, 목차 단추를 DOM에서 찾는다.
// 서류(Paper)는 li[data-inbox-item], 목차 줄은 [data-inbox-group]·[data-review-item]이다(Inbox.tsx).
import { REVIEW_PREFIX } from "./inboxGroups";

/** 지금 결재함에 펼쳐진 서류들(위에서 아래 순서) */
export function sheetPapers(root: ParentNode = document): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      "[data-inbox-sheet] [data-inbox-item]",
    ),
  ];
}

/** 서류의 첫 동작 단추로 포커스. 단추가 없으면 서류 자체로(tabIndex -1) */
export function focusPaper(el: HTMLElement | undefined): boolean {
  if (!el) return false;
  const target =
    el.querySelector<HTMLElement>("[data-action]:not(:disabled)") ?? el;
  target.focus();
  el.scrollIntoView({ block: "nearest" });
  return true;
}

/** 포커스가 어디에도 없는지(누른 단추가 서류와 함께 사라져 body로 떨어졌을 때) */
export function focusLost(): boolean {
  const a = document.activeElement;
  return !a || a === document.body || !a.isConnected;
}

/** 목차에서 그 열쇠의 단추(리뷰 칸 줄 또는 승무원 묶음) */
export function indexButton(key: string): HTMLElement | null {
  const sel = key.startsWith(REVIEW_PREFIX)
    ? `[data-review-item="${CSS.escape(key.slice(REVIEW_PREFIX.length))}"]`
    : `[data-inbox-group="${CSS.escape(key)}"]`;
  return document.querySelector<HTMLElement>(sel);
}

/** 목차 단추를 위에서 아래 순서로: 리뷰 칸 줄 다음 승무원 묶음. 열쇠와 눌린 것도 함께 */
export function indexKeys(): { keys: string[]; current: string | undefined } {
  const keys: string[] = [];
  let current: string | undefined;
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-inbox-index] [data-review-item], [data-inbox-index] [data-inbox-group]",
  )) {
    const review = el.dataset.reviewItem;
    const key =
      review !== undefined
        ? `${REVIEW_PREFIX}${review}`
        : el.dataset.inboxGroup;
    if (!key) continue;
    keys.push(key);
    if (el.getAttribute("aria-pressed") === "true") current = key;
  }
  return { keys, current };
}
