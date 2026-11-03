// 창(모달) 안에서 Tab을 돌리는 계산. DOM 없이 시험하려고 순번만 다룬다.

/** 포커스 받을 수 있는 요소 고르기(숨은 것·막힌 것은 부르는 쪽에서 거른다) */
export const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable=true]';

/**
 * Tab을 눌렀을 때 옮겨 갈 순번. 끝에서 넘어가면 처음으로, 처음에서 Shift+Tab이면 끝으로 돌린다.
 * 그 밖(창 가운데)은 브라우저에 맡기려고 null을 돌려준다. 창 밖에 포커스가 있으면(-1) 처음·끝으로 끌어온다.
 */
export function wrapFocus(
  current: number,
  count: number,
  back: boolean,
): number | null {
  if (count === 0) return null;
  if (current < 0) return back ? count - 1 : 0;
  if (back && current === 0) return count - 1;
  if (!back && current === count - 1) return 0;
  return null;
}
