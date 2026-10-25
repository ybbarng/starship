"use client";

// 자리 표시: 조종석 층(계기·작업 띠·접히는 패널·교신 신호). 에이전트가 채운다.
export function Cockpit({
  active,
}: {
  /** 첫 장면일 때만 true. false면 키보드 단축키 등을 꺼 둔다. */
  active: boolean;
  /** 스크롤 문턱까지 밀린 정도(0..1) */
  push: number;
  /** 내부 장면으로 가기 */
  onInterior: () => void;
}) {
  return active ? null : null;
}
