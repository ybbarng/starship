// 값 보호: 호출 인자(args) 가운데 비밀값처럼 보이는 글자를 찾아 지운다.
// 서버(API 라우트)가 내려 보내기 전에 지우고, 화면도 한 번 더 보고 그리지 않는다. 설명: docs/secure.md "값 보호".

/** 비서가 미리 가려 보낸 인자. 그대로 보여도 된다. */
export const REDACTED_BY_HQ = "<가림>";
/** Starship이 값처럼 보여 지운 자리. 화면은 이 글자 대신 경고를 보인다. */
export const HIDDEN_ARG = "<값 숨김>";

const MIN_LEN = 20;
/** 구분자(. _ -) 없이 이어진 가장 긴 덩어리의 하한 */
const MIN_CHUNK = 16;
/** 글자당 섀넌 엔트로피(비트) 하한. 무작위 영숫자 20자는 보통 4 안팎, 낱말을 이은 이름은 3 아래로 나온다 */
const MIN_ENTROPY = 3.3;

/** 글자당 섀넌 엔트로피(비트). */
export function entropy(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * 긴 무작위 문자열(토큰·비밀번호·키)처럼 보이나.
 * 20자 이상, 빈칸·op:// 없음, 그리고 점·밑줄·붙임표·슬래시로 나눈 가장 긴 덩어리가
 * 16자 이상이면서 소문자·대문자·숫자 중 두 가지 이상 섞이고 엔트로피가 높을 때.
 * 덩어리를 보는 까닭: blog.deploy.production.v2 같은 이름은 글자 종류가 섞여도 짧은 낱말을 이은 것이다.
 * 슬래시가 들었다고 통째로 건너뛰지 않는다: base64 값에는 /와 +가 섞인다(2026-11-10). 경로는 덩어리가 짧은 낱말이라 걸리지 않는다.
 */
export function looksSecret(s: string): boolean {
  if (s.length < MIN_LEN) return false;
  if (/\s/.test(s) || s.includes("op:")) return false;
  const chunk = s
    .split(/[._\-/]/)
    .reduce((a, b) => (b.length > a.length ? b : a), "");
  if (chunk.length < MIN_CHUNK) return false;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((re) =>
    re.test(chunk),
  ).length;
  if (kinds < 2) return false;
  return entropy(chunk) >= MIN_ENTROPY;
}

/**
 * 인자 하나를 본다. `--token=값`처럼 등호가 있으면 등호 뒤만 본다.
 * 값처럼 보이면 그 부분을 HIDDEN_ARG로 바꾼다.
 */
export function scrubArg(arg: string): { arg: string; hidden: boolean } {
  if (arg === REDACTED_BY_HQ) return { arg, hidden: false };
  const eq = arg.indexOf("=");
  if (eq > 0 && looksSecret(arg.slice(eq + 1)))
    return { arg: `${arg.slice(0, eq + 1)}${HIDDEN_ARG}`, hidden: true };
  if (looksSecret(arg)) return { arg: HIDDEN_ARG, hidden: true };
  return { arg, hidden: false };
}

/** 인자 목록 전체를 본다. 지운 개수도 센다. */
export function scrubArgs(args: readonly string[]): {
  args: string[];
  hidden: number;
} {
  let hidden = 0;
  const out = args.map((a) => {
    const r = scrubArg(a);
    if (r.hidden) hidden += 1;
    return r.arg;
  });
  return { args: out, hidden };
}

/**
 * 글(목적·계획·부모 명령 등) 속 낱말마다 같은 판정을 해서 값처럼 보이는 낱말만 지운다.
 * 빈칸은 그대로 둔다.
 */
export function scrubText(text: string): { text: string; hidden: number } {
  let hidden = 0;
  const out = text
    .split(/(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      const r = scrubArg(part);
      if (r.hidden) hidden += 1;
      return r.arg;
    })
    .join("");
  return { text: out, hidden };
}
