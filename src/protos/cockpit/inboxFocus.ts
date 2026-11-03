"use client";

// 결재함 포커스 도우미: 처리 뒤 이어서 볼 서류, J/K로 옮길 서류, 목차 단추를 DOM에서 찾는다.
// 서류(Paper)는 li[data-inbox-item], 목차 줄은 [data-inbox-group]·[data-review-item]이다(Inbox.tsx).
import { REVIEW_PREFIX, stepKey } from "./inboxGroups";

export type InboxKey =
  | { type: "paper"; d: -1 | 1 }
  | { type: "group"; d: -1 | 1 }
  | { type: "choice"; n: number }
  | { type: "snooze" };

/**
 * 결재함 단축키(2026-11-03): J/K 다음·이전 서류, [ ] 이전·다음 묶음(리뷰 칸 포함),
 * 1~9 포커스한 서류의 선택지, S 1시간 뒤. 한글 자판에서도 같은 자리 글쇠(ㅓ·ㅏ·ㄴ)를 받는다(G를 ㅎ로 받듯이).
 */
export function inboxKey(key: string): InboxKey | null {
  switch (key) {
    case "j":
    case "J":
    case "ㅓ":
      return { type: "paper", d: 1 };
    case "k":
    case "K":
    case "ㅏ":
      return { type: "paper", d: -1 };
    case "]":
      return { type: "group", d: 1 };
    case "[":
      return { type: "group", d: -1 };
    case "s":
    case "S":
    case "ㄴ":
      return { type: "snooze" };
  }
  return /^[1-9]$/.test(key) ? { type: "choice", n: Number(key) } : null;
}

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

/** 포커스가 결재함 서류 안이면 그 서류 */
function focusedPaper(): HTMLElement | null {
  return (
    (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
      "[data-inbox-sheet] [data-inbox-item]",
    ) ?? null
  );
}

function press(btn: HTMLElement | null | undefined): boolean {
  // 보내는 동안은 fieldset disabled로 막혀 있다(TaskActions). 단추 자신의 disabled만 보면 지나간다
  if (!btn || btn.matches(":disabled")) return false;
  btn.click();
  return true;
}

/** 단축키 하나를 결재함에 실행한다. 한 일이 있으면 true(그때만 키의 기본 동작을 막는다) */
export function runInboxKey(cmd: InboxKey): boolean {
  if (cmd.type === "paper") {
    const papers = sheetPapers();
    if (!papers.length) return false;
    const cur = focusedPaper();
    const i = cur ? papers.indexOf(cur) : -1;
    const j =
      i < 0
        ? cmd.d > 0
          ? 0
          : papers.length - 1
        : Math.max(0, Math.min(papers.length - 1, i + cmd.d));
    return focusPaper(papers[j]);
  }
  if (cmd.type === "group") {
    const { keys, current } = indexKeys();
    const next = stepKey(keys, current, cmd.d);
    const btn = next ? indexButton(next) : null;
    if (!btn) return false;
    if (next !== current) btn.click();
    btn.focus();
    btn.scrollIntoView({ block: "nearest" });
    return true;
  }
  const paper = focusedPaper();
  if (!paper) return false;
  if (cmd.type === "choice")
    return press(
      paper.querySelectorAll<HTMLElement>("[data-choice]")[cmd.n - 1],
    );
  return press(paper.querySelector<HTMLElement>('[data-action="snooze"]'));
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
