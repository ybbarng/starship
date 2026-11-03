// 장면 넘김(useScrollStage)이 ↑↓·PageUp/Down을 가로채지 말아야 할 때를 고른다.
// 브라우저 없이 시험하려고 DOM에 기대지 않는 순수 함수로 둔다.

/** 화살표·글쇠를 스스로 쓰는 조작 요소. 여기에 포커스가 있으면 키는 그 요소 몫이다. */
export const KEY_OWNERS =
  "input,textarea,select,[contenteditable=''],[contenteditable=true],[role=listbox],[role=menu],[role=menubar],[role=slider],[role=spinbutton],[role=tablist],[role=radiogroup],[role=combobox],[role=grid],[role=tree]";

/** 스스로 스크롤하는 목록이나 대화상자. 휠·터치와 같은 기준 */
export const SCROLL_OWNERS = "[data-scroll-inside],[role=dialog]";

type Closest = { closest: (selector: string) => unknown } | null;

/**
 * 이 키를 장면 넘김에 쓰지 않고 그대로 둘지.
 * - 대화상자(모달)가 열려 있으면 언제나 둔다(뒤에 깔린 장면을 바꾸지 않게).
 * - 포커스가 스스로 스크롤하는 목록·대화상자 안이면 둔다(결재함 서류에 포커스를 두고 ↓를 눌러도 선내로 가지 않게).
 * - 포커스가 화살표를 쓰는 조작 요소면 둔다.
 * - 보통 단추·링크는 가로채도 된다: 마우스로 누르면 포커스가 단추에 남아서, 막으면 ↓로 선내에 가지 못한다.
 */
export function keyStaysPut({
  target,
  dialogOpen,
  modifier = false,
}: {
  target: Closest;
  dialogOpen: boolean;
  /** Alt·Ctrl·Meta를 함께 누른 키(브라우저·운영체제 단축키) */
  modifier?: boolean;
}): boolean {
  if (dialogOpen || modifier) return true;
  if (!target) return false;
  return !!(target.closest(SCROLL_OWNERS) || target.closest(KEY_OWNERS));
}
