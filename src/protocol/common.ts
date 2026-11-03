// 프로토콜 여러 형식(v1·지도·책상)이 함께 쓰는 조각. 모두 순수 함수·스키마로 둔다.
// 본부(같은 스키마를 쓰는 다른 저장소)도 같은 규칙으로 읽는다.
import { z } from "zod";

/** http(s) 주소만 받는다. 화면에서 그대로 링크로 여니까 javascript:·data:·file: 같은 다른 scheme은 막는다. */
export const WebUrl = z
  .url()
  .refine((s) => /^https?:\/\//i.test(s), "http(s) 주소만 쓸 수 있어요");

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 날짜·시각 글을 Unix 밀리초로. 읽지 못하면 NaN.
 * 날짜만 적은 값("2026-10-31")은 이 컴퓨터 시간대의 자정으로 읽는다.
 * Date.parse는 날짜만 있으면 UTC 자정으로 읽어서, 한국에서는 오전 9시가 되어 "몇 시간 전"이 어긋났다.
 */
export function parseWhen(s: string): number {
  const m = DATE_ONLY.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = new Date(y, mo - 1, d);
    // 2026-02-31처럼 없는 날은 다음 달로 넘어가니 받지 않는다
    return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d
      ? t.getTime()
      : Number.NaN;
  }
  return Date.parse(s);
}

/** 날짜("2026-10-31")나 시각("2026-10-31T10:12:00+09:00"). parseWhen으로 읽을 수 있는 글이면 받는다. */
export const When = z
  .string()
  .refine((s) => !Number.isNaN(parseWhen(s)), "날짜로 읽을 수 없어요");

/** 너그러운 배열을 읽은 결과: 맞는 항목과, 빠진 항목마다 사람이 읽을 한 줄. */
export type Lenient<T> = { items: T[]; problems: string[] };

function idOf(v: unknown): string {
  if (typeof v === "object" && v !== null && "id" in v) {
    const id = (v as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return ` (id ${id})`;
  }
  return "";
}

/**
 * 배열은 받되 항목마다 따로 검사해, 틀린 항목만 빼고 나머지는 남긴다.
 * 본부가 enum 값 하나만 더해도(새 TaskKind 등) 화면 전체가 죽지 않게 한다.
 * 빠진 항목은 "tasks[3] (id t1): kind: …" 꼴로 problems에 적는다. 배열이 아니면 그때는 실패한다.
 */
export function lenientArray<T extends z.ZodType>(item: T, label: string) {
  return z.array(z.unknown()).transform((raw): Lenient<z.output<T>> => {
    const items: z.output<T>[] = [];
    const problems: string[] = [];
    raw.forEach((v, i) => {
      const r = item.safeParse(v);
      if (r.success) {
        items.push(r.data);
        return;
      }
      const why = r.error.issues
        .map((iss) => `${iss.path.join(".") || "(항목)"}: ${iss.message}`)
        .join("; ");
      problems.push(`${label}[${i}]${idOf(v)}: ${why}`);
    });
    return { items, problems };
  });
}
