"use client";

// 자리 표시: 구조화된 우주선 내부(갑판 층층). 에이전트가 채운다.
export function Interior({
  active,
}: {
  /** 내부 장면일 때만 true */
  active: boolean;
  /** 조종석으로 돌아가기 */
  onCockpit: () => void;
}) {
  return active ? null : null;
}
