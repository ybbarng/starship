// 책상 기다림에서 "보기·열기" 단추를 붙일 파일 경로를 고른다(2026-11-03).
// 세션이 path 필드 없이 label 글 속에만 경로를 적는 일이 있어서, 결재함처럼 글 속 경로도 찾는다.
// 검사는 서버(/api/files)가 한다. 여기서는 어느 자리에 어떤 경로를 붙일지만 정한다. 설계: docs/files.md.
import type { Waiting } from "@/protocol/desk";
import { findPaths } from "@/ui/kit/filePaths";

type Entry = { path?: string; label: string; look?: string; note?: string };

/** 선택지·확인 항목 하나에 붙일 경로. path가 있으면 그것만, 없으면 label·look·note 글 속 경로. */
export function entryPaths(e: Entry): string[] {
  if (e.path) return [e.path];
  return findPaths([e.label, e.look, e.note].filter(Boolean).join("\n"));
}

export type WaitFiles = {
  /** 기다림 세부(detail) 글 속 경로 중 아래 선택지·항목에 이미 붙은 것을 뺀 것 */
  detail: string[];
  /** options[i]에 붙일 경로 */
  options: string[][];
  /** items[i]에 붙일 경로 */
  items: string[][];
};

/**
 * 기다림 하나의 자리별 경로. 같은 경로는 한 번만 붙인다: 앞 선택지·항목에 이미 붙었으면 뒤에서 빼고,
 * 세부 글의 경로도 선택지·항목에 붙은 것이면 뺀다.
 */
export function waitFiles(w: Waiting): WaitFiles {
  const seen = new Set<string>();
  const fresh = (paths: string[]) =>
    paths.filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  const options = (w.options ?? []).map((o) => fresh(entryPaths(o)));
  const items = (w.items ?? []).map((it) => fresh(entryPaths(it)));
  const detail = fresh(w.detail ? findPaths(w.detail) : []);
  return { detail, options, items };
}
