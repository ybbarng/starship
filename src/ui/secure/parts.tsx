"use client";

// 보안 구역 화면 조각: 이름 가림 단추, 명령 줄, 신청서 카드, 호출 줄.
// 값처럼 보이는 글자는 여기서 그리지 않는다(tokenizeArgs가 hidden으로 바꾸고 글자를 담지 않는다).
import { useState } from "react";
import type { SecureRequest } from "@/protocol/secure";
import { type ArgToken, maskRef, tokenizeArgs } from "@/secure/mask";
import { type CallRow, remainingLabel } from "@/secure/rows";
import { scrubText } from "@/secure/secret";

export const RED = "#ff6b6b";
export const AI_COLOR = "#6aa8ff";
export const HUMAN_COLOR = "#ffb45c";

/** 오늘이면 "14:03", 아니면 "11/9 14:03". */
export function clock(t: number, now: number): string {
  const d = new Date(t);
  const n = new Date(now);
  const p = (x: number) => String(x).padStart(2, "0");
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.toDateString() === n.toDateString()
    ? hm
    : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/**
 * 금고·항목 이름. 처음엔 일부만 보이고, 누르면 전체, 다시 누르면 다시 가린다.
 * 키보드로도 누를 수 있게 button으로 둔다.
 */
export function NameToggle({
  full,
  short,
  className = "",
}: {
  full: string;
  short: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      data-secure-name
      aria-pressed={open}
      aria-label={open ? "이름 가리기" : "이름 전체 보기"}
      onClick={() => setOpen((v) => !v)}
      className={`inline rounded px-1 text-left font-mono [overflow-wrap:anywhere] hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/50 ${
        open ? "bg-white/[0.06] text-white" : "text-white/80"
      } ${className}`}
    >
      {open ? full : short}
    </button>
  );
}

/** 참조 하나(신청서 대상의 ref 등)를 가림 단추로. */
export function RefName({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <NameToggle full={value} short={maskRef(value)} className={className} />
  );
}

function Token({ t }: { t: ArgToken }) {
  if (t.kind === "text")
    return (
      <span className="font-mono [overflow-wrap:anywhere] text-white/70">
        {t.text}
      </span>
    );
  if (t.kind === "name") return <NameToggle full={t.full} short={t.short} />;
  return (
    <span className="font-mono text-white/70">
      {t.prefix}
      <span
        data-secure-hidden
        className="rounded bg-[#ffcf5c]/15 px-1 text-[#ffcf5c]"
      >
        값 숨김
      </span>
    </span>
  );
}

/** op 명령 한 줄. 인자마다 그대로·가림·숨김으로 나눠 그린다. */
export function CommandLine({ sub, args }: { sub: string; args: string[] }) {
  const tokens = tokenizeArgs(sub, args);
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12.5px]">
      <span className="font-mono text-white">op {sub}</span>
      {tokens.map((t, i) => (
        // 인자 순서가 곧 자리라 번호를 열쇠로 쓴다
        // biome-ignore lint/suspicious/noArrayIndexKey: 인자 목록은 바뀌지 않는다
        <Token key={i} t={t} />
      ))}
    </span>
  );
}

export function hasHiddenArg(sub: string, args: string[]): boolean {
  return tokenizeArgs(sub, args).some((t) => t.kind === "hidden");
}

/** 남은 시간 표. 5분 안쪽이면 노랗게, 만료면 흐리게. */
export function Remaining({
  expiresAt,
  now,
}: {
  expiresAt: number;
  now: number;
}) {
  const left = expiresAt - now;
  const color =
    left <= 0
      ? "bg-white/[0.06] text-white/45"
      : left < 5 * 60_000
        ? "bg-[#ffcf5c]/15 text-[#ffcf5c]"
        : "bg-[#5ee08a]/15 text-[#5ee08a]";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${color}`}
    >
      {remainingLabel(expiresAt, now)}
    </span>
  );
}

/** 신청서의 대상 목록: 동작(read 등)과 참조. */
export function Items({ items }: { items: SecureRequest["items"] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li
          key={`${it.action}:${it.ref}`}
          className="flex items-baseline gap-2 text-[13px]"
        >
          <span className="w-12 shrink-0 rounded bg-white/[0.07] px-1 text-center font-mono text-[11px] text-white/70">
            {it.action}
          </span>
          <RefName value={it.ref} className="min-w-0" />
        </li>
      ))}
    </ul>
  );
}

/** 가장 최근 신청서를 크게. 팝업이 떴을 때 이것만 보고 정할 수 있게 한다. */
export function BigRequest({
  r,
  now,
  calls,
}: {
  r: SecureRequest;
  now: number;
  calls: number;
}) {
  const active = r.expiresAt > now;
  return (
    <article
      data-secure-latest
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        active
          ? "border-[#6aa8ff]/40 bg-[#6aa8ff]/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-white/40">
          가장 최근 신청서
        </span>
        <Remaining expiresAt={r.expiresAt} now={now} />
        <span className="ml-auto text-[11.5px] text-white/40">
          {clock(r.at, now)}에 씀
        </span>
      </header>
      <h3 className="text-[20px] leading-tight font-semibold [overflow-wrap:anywhere]">
        {r.session.name ?? r.session.key}
      </h3>
      <p className="text-[16px] leading-snug [overflow-wrap:anywhere]">
        {r.purpose}
      </p>
      {r.plan.length > 0 && (
        <section>
          <h4 className="mb-1 text-[11px] font-semibold text-white/45">
            할 일
          </h4>
          <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-[14px] text-white/85">
            {r.plan.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 계획은 순서가 곧 자리다
              <li key={i}>{p}</li>
            ))}
          </ol>
        </section>
      )}
      <section>
        <h4 className="mb-1 text-[11px] font-semibold text-white/45">
          꺼낼 것
        </h4>
        <Items items={r.items} />
      </section>
      <footer className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/50">
        {r.card && <span>카드 {r.card}</span>}
        <span>이 신청서로 나간 호출 {calls}건</span>
      </footer>
    </article>
  );
}

/** 유효한 신청서 작은 카드(가장 최근 것 말고 나머지). */
export function SmallRequest({
  r,
  now,
  calls,
}: {
  r: SecureRequest;
  now: number;
  calls: number;
}) {
  return (
    <article
      data-secure-active
      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">{r.session.name ?? r.session.key}</span>
        <Remaining expiresAt={r.expiresAt} now={now} />
        <span className="ml-auto text-[11.5px] text-white/40">
          {clock(r.at, now)}
        </span>
      </header>
      <p className="text-[13.5px] [overflow-wrap:anywhere]">{r.purpose}</p>
      <Items items={r.items} />
      <footer className="flex flex-wrap gap-x-3 text-[11.5px] text-white/45">
        {r.card && <span>카드 {r.card}</span>}
        <span>호출 {calls}건</span>
      </footer>
    </article>
  );
}

/** 기록 목록의 신청서 한 줄. */
export function RequestLine({
  r,
  now,
  calls,
}: {
  r: SecureRequest;
  now: number;
  calls: number;
}) {
  return (
    <li
      data-secure-request={r.id}
      className="flex flex-col gap-1.5 border-b border-white/[0.06] px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className="font-mono text-white/45">{clock(r.at, now)}</span>
        <span className="font-semibold" style={{ color: AI_COLOR }}>
          {r.session.name ?? r.session.key}
        </span>
        <Remaining expiresAt={r.expiresAt} now={now} />
        {r.card && <span className="text-white/45">카드 {r.card}</span>}
        <span className="ml-auto text-white/40">호출 {calls}건</span>
      </div>
      <p className="text-[13.5px] [overflow-wrap:anywhere]">{r.purpose}</p>
      <Items items={r.items} />
    </li>
  );
}

/** 기록 목록의 호출 한 줄(hook·wrapper 짝을 묶은 것). 빨간 까닭이 있으면 빨갛게. */
export function CallLine({
  row,
  now,
  request,
}: {
  row: CallRow;
  now: number;
  request?: SecureRequest;
}) {
  const red = row.alerts.length > 0;
  const hidden = hasHiddenArg(row.command.sub, row.command.args);
  const ctx = row.context;
  return (
    <li
      data-secure-call={row.key}
      data-secure-red={red || undefined}
      className={`flex flex-col gap-1.5 border-b px-3 py-2.5 ${
        red
          ? "border-[#ff6b6b]/30 bg-[#ff6b6b]/[0.08] shadow-[inset_3px_0_0_#ff6b6b]"
          : "border-white/[0.06]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className="font-mono text-white/45">{clock(row.at, now)}</span>
        {row.actor === "human" ? (
          <span
            className="rounded px-1.5 py-0.5 font-semibold"
            style={{ color: HUMAN_COLOR, background: `${HUMAN_COLOR}22` }}
          >
            직접 실행
          </span>
        ) : (
          <span className="font-semibold" style={{ color: AI_COLOR }}>
            AI · {row.session?.name ?? row.session?.key ?? "세션 모름"}
          </span>
        )}
        <span className="text-white/35">{row.vias.join("+")}</span>
        {row.decision === "denied" && (
          <span className="font-semibold" style={{ color: RED }}>
            막힘
          </span>
        )}
        {row.exit !== undefined && (
          <span className={row.exit === 0 ? "text-white/40" : "text-[#ffcf5c]"}>
            종료 {row.exit}
          </span>
        )}
        {row.ms !== undefined && (
          <span className="text-white/35">
            {row.ms < 1000 ? `${row.ms}ms` : `${(row.ms / 1000).toFixed(1)}초`}
          </span>
        )}
      </div>
      <CommandLine sub={row.command.sub} args={row.command.args} />
      {row.alerts.map((a) => (
        <p
          key={a}
          className="text-[12.5px] font-semibold"
          style={{ color: RED }}
        >
          ⚠ {a}
        </p>
      ))}
      {hidden && (
        <p className="text-[12px] text-[#ffcf5c]">
          값처럼 보이는 글자를 숨겼어요. 이 화면에서는 볼 수 없어요.
        </p>
      )}
      {row.requestId && (
        <p className="text-[12px] text-white/55 [overflow-wrap:anywhere]">
          신청서:{" "}
          {request
            ? `${request.session.name ?? request.session.key} · ${request.purpose}`
            : `${row.requestId} (목록에 없음)`}
        </p>
      )}
      {row.actor === "human" && ctx && (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-white/50">
          {ctx.termProgram && <span>터미널 {ctx.termProgram}</span>}
          {ctx.tty && <span className="font-mono">{ctx.tty}</span>}
          {ctx.gitRoot && (
            <span className="[overflow-wrap:anywhere]">
              폴더 <span className="font-mono">{ctx.gitRoot}</span>
            </span>
          )}
          {ctx.parentCmd && (
            <span className="[overflow-wrap:anywhere]">
              부모 명령{" "}
              <span className="font-mono">{scrubText(ctx.parentCmd).text}</span>
            </span>
          )}
        </p>
      )}
    </li>
  );
}
