// 금고·항목 이름 가림: 화면에 처음엔 일부만 보이고, 누르면 전체를 보인다. 화면 표시용이다.
// 값 보호(src/secure/secret.ts)와 다르다. 그쪽은 아예 그리지 않는다. 설명: docs/secure.md "이름 가림".
import { HIDDEN_ARG, looksSecret } from "./secret";

const DOTS = "•••";

/**
 * 조각 하나(슬래시로 나눈 것)의 앞 몇 글자와 끝 몇 글자만 남긴다.
 * 짧은 조각은 앞 1~3글자만 남긴다. 예: Personal → Per•••, blog.deploy.prod → blog.d•••od.
 */
export function maskSegment(seg: string): string {
  const n = [...seg].length;
  if (n === 0) return seg;
  const chars = [...seg];
  if (n <= 3) return `${chars[0]}${DOTS}`;
  if (n <= 5) return `${chars.slice(0, 2).join("")}${DOTS}`;
  if (n <= 10) return `${chars.slice(0, 3).join("")}${DOTS}`;
  const back = n >= 16 ? 3 : 2;
  const front = Math.ceil(n * 0.35);
  return `${chars.slice(0, front).join("")}${DOTS}${chars.slice(n - back).join("")}`;
}

/**
 * 참조 하나를 가린다. op://금고/항목/칸 꼴이면 op://는 남기고 조각마다 가린다.
 * 뒤에 붙은 ?attribute=otp 같은 물음표 뒤는 그대로 둔다.
 */
export function maskRef(ref: string): string {
  const scheme = ref.startsWith("op://") ? "op://" : "";
  const rest = ref.slice(scheme.length);
  const q = rest.indexOf("?");
  const path = q >= 0 ? rest.slice(0, q) : rest;
  const query = q >= 0 ? rest.slice(q) : "";
  return `${scheme}${path.split("/").map(maskSegment).join("/")}${query}`;
}

const OP_REF = /op:\/\/[^\s"'`]+/g;

/** 글 속의 op:// 참조만 찾아 가린다. 참조가 없으면 그대로. */
export function maskRefsIn(text: string): string {
  return text.replace(OP_REF, (m) => maskRef(m));
}

export function hasRef(text: string): boolean {
  return text.includes("op://");
}

/** 값이 금고·항목 이름인 옵션. 값을 가린다 */
const NAME_FLAGS = new Set([
  "--vault",
  "--account",
  "--fields",
  "--field",
  "--tags",
]);
/** 값을 받지만 이름이 아닌 옵션. 값을 그대로 보인다 */
const PLAIN_VALUE_FLAGS = new Set([
  "--format",
  "--categories",
  "--cache",
  "--out-file",
  "-o",
  "--session",
]);
/** 뒤따르는 낱말(동사 다음)이 항목 이름인 하위 명령 */
const ITEM_SUBS = new Set(["item", "document"]);

/**
 * 화면에 그릴 인자 조각.
 * - text: 그대로 보인다
 * - name: 금고·항목 이름이 든 것. 처음엔 short, 누르면 full
 * - hidden: 값처럼 보여 숨겼다. 글자는 담지 않는다(prefix는 `--token=` 같은 앞부분)
 */
export type ArgToken =
  | { kind: "text"; text: string }
  | { kind: "name"; full: string; short: string }
  | { kind: "hidden"; prefix: string };

function hiddenOf(arg: string): ArgToken | null {
  const at = arg.indexOf(HIDDEN_ARG);
  if (at >= 0) return { kind: "hidden", prefix: arg.slice(0, at) };
  const eq = arg.indexOf("=");
  if (eq > 0 && looksSecret(arg.slice(eq + 1)))
    return { kind: "hidden", prefix: arg.slice(0, eq + 1) };
  if (looksSecret(arg)) return { kind: "hidden", prefix: "" };
  return null;
}

const name = (full: string, short: string): ArgToken =>
  full === short ? { kind: "text", text: full } : { kind: "name", full, short };

/**
 * op 하위 명령(sub)과 인자를 화면 조각으로 나눈다.
 * 값처럼 보이는 것은 hidden(글자 없음), op:// 참조와 --vault 같은 옵션 값, item get 뒤 항목 이름은 name.
 */
export function tokenizeArgs(sub: string, args: readonly string[]): ArgToken[] {
  const out: ArgToken[] = [];
  let nameNext = false;
  let plainNext = false;
  let positional = 0;
  for (const arg of args) {
    const hidden = hiddenOf(arg);
    if (hidden) {
      out.push(hidden);
      nameNext = plainNext = false;
      continue;
    }
    if (nameNext) {
      // --fields label=칸이름 처럼 등호가 있으면 등호 앞(label=)은 그대로 둔다
      const eq = arg.indexOf("=");
      const short = hasRef(arg)
        ? maskRefsIn(arg)
        : eq > 0
          ? `${arg.slice(0, eq + 1)}${maskRef(arg.slice(eq + 1))}`
          : maskRef(arg);
      out.push(name(arg, short));
      nameNext = false;
      continue;
    }
    if (plainNext) {
      out.push({ kind: "text", text: arg });
      plainNext = false;
      continue;
    }
    if (arg.startsWith("-")) {
      const eq = arg.indexOf("=");
      const flag = eq > 0 ? arg.slice(0, eq) : arg;
      if (eq > 0 && NAME_FLAGS.has(flag)) {
        out.push(
          name(arg, `${arg.slice(0, eq + 1)}${maskRef(arg.slice(eq + 1))}`),
        );
        continue;
      }
      if (eq < 0 && NAME_FLAGS.has(flag)) nameNext = true;
      if (eq < 0 && PLAIN_VALUE_FLAGS.has(flag)) plainNext = true;
      out.push(name(arg, maskRefsIn(arg)));
      continue;
    }
    positional += 1;
    if (hasRef(arg)) {
      out.push(name(arg, maskRefsIn(arg)));
      continue;
    }
    // op item get <항목>: 첫 낱말(get·edit 같은 동사) 다음 낱말부터 항목 이름
    if (ITEM_SUBS.has(sub) && positional >= 2) {
      out.push(name(arg, maskRef(arg)));
      continue;
    }
    out.push({ kind: "text", text: arg });
  }
  return out;
}

/** 인자 가운데 값처럼 보여 숨긴 것이 있나. */
export function hasHidden(tokens: readonly ArgToken[]): boolean {
  return tokens.some((t) => t.kind === "hidden");
}
