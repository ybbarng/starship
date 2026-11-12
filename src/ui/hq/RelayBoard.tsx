"use client";

// 본부 방 "나르기" 판: 비서가 세션 사이에 나르는 일. 누가 부탁했고, 지금 어디 있고, 얼마나 멈춰 있는지.
// 진행 중(멈춤은 노랗게) → 끝·그만둠(흐리게, 7일까지) → 어느 일인지 모르는 넘김. 설계: docs/hq.md "나르기 기록".
import type { RelayLine, RelayResponse } from "@/protocol/relay";
import {
  type RelayBoard as Board,
  KIND_LABEL,
  type Relay,
  STATE_LABEL,
  whereLabel,
} from "@/relay/fold";
import { agoLabel } from "@/ui/kit/labels";

const H3 = "mb-2 text-[10.5px] font-semibold tracking-[0.18em] text-white/35";

export function RelayBoard({
  data,
  error,
  board,
  hqName,
  now,
}: {
  data?: RelayResponse;
  error?: Error | null;
  /** data를 접은 판(부르는 쪽이 멈춤 건수와 함께 한 번만 접는다) */
  board: Board;
  /** 본부 승무원 이름("지금 있는 곳"이 비서일 때) */
  hqName: string;
  now: number;
}) {
  const problems = data?.log.problems ?? [];
  return (
    <div className="flex min-w-0 flex-col gap-5 text-[13px]" data-relay-board>
      {data?.source === "demo" && (
        <p data-relay-demo className="text-[12px] text-white/45">
          데모 · 지어낸 기록이에요
        </p>
      )}
      {error && (
        <p
          data-relay-error
          className="rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3 py-2 text-[12.5px] text-[#ffd0d0]"
        >
          나르기 기록을 받아 오지 못했어요 · {error.message}
        </p>
      )}
      {!data && !error ? (
        <p className="text-white/45">나르기 기록을 읽는 중…</p>
      ) : data?.status === "none" ? (
        <div data-relay-none>
          <p className="text-white/70">본부에 나르기 기록이 아직 없어요</p>
          <p className="mt-1 text-[12px] text-white/40">
            비서가 나르기 기록 끝점(/api/relays)을 두면 여기에 보여요.
          </p>
        </div>
      ) : data ? (
        <>
          {problems.length > 0 && (
            <p
              data-relay-problems
              title={problems.join("\n")}
              className="text-[12px] text-[#ffb0b0]"
            >
              형식이 틀려 뺀 기록 {problems.length} ·{" "}
              <span className="text-white/45">{problems[0]}</span>
            </p>
          )}
          <section>
            <h3 className={H3}>나르는 중 {board.active.length}</h3>
            {board.active.length ? (
              <ul className="space-y-2">
                {board.active.map((r) => (
                  <RelayCard key={r.id} relay={r} hqName={hqName} now={now} />
                ))}
              </ul>
            ) : (
              <p className="text-white/40">나르는 일이 없어요</p>
            )}
          </section>
          {board.done.length > 0 && (
            <section>
              <h3 className={H3}>끝·그만둠 (7일 안) {board.done.length}</h3>
              <ul className="space-y-2">
                {board.done.map((r) => (
                  <RelayCard key={r.id} relay={r} hqName={hqName} now={now} />
                ))}
              </ul>
            </section>
          )}
          {board.unlinked.length > 0 && (
            <section data-relay-unlinked>
              <h3 className={H3}>
                어느 일인지 모르는 넘김 {board.unlinked.length}
              </h3>
              <p className="mb-1.5 text-[11.5px] text-white/40">
                비서가 메시지 첫 줄에 나르기 표시를 붙이지 않은 넘김이에요.
              </p>
              <ul className="divide-y divide-white/[0.06]">
                {board.unlinked.map((l, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 기록은 덧붙기만 하고 같은 시각 줄을 가르는 칸이 없다
                  <Unlinked key={`${l.at}-${i}`} line={l} now={now} />
                ))}
              </ul>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

const STATE_CHIP: Record<Relay["state"], string> = {
  open: "bg-[#7ce0ff]/15 text-[#a8ecff]",
  moving: "bg-[#5ee08a]/15 text-[#8ff0b0]",
  returned: "bg-[#c6a8ff]/15 text-[#ddccff]",
  closed: "bg-white/[0.08] text-white/60",
  cancelled: "bg-white/[0.08] text-white/60",
};

function RelayCard({
  relay: r,
  hqName,
  now,
}: {
  relay: Relay;
  hqName: string;
  now: number;
}) {
  const frame = r.stalled
    ? "border-[#ffcf5c]/60 bg-[#ffcf5c]/[0.07]"
    : r.done
      ? "border-white/[0.06] opacity-55"
      : "border-white/[0.1] bg-white/[0.03]";
  return (
    <li
      data-relay={r.id}
      data-relay-state={r.state}
      data-relay-stalled={r.stalled || undefined}
      className={`rounded-md border px-3 py-2 ${frame}`}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 font-medium break-words text-white/90">
          {r.title ?? r.id}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${STATE_CHIP[r.state]}`}
        >
          {STATE_LABEL[r.state]}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-white/65">
        <span title="처음 부탁한 세션">{r.from ?? "부탁한 세션 모름"}</span>
        {!r.done && (
          <>
            <span className="text-white/35">→</span>
            <span title="지금 있는 곳" className="font-semibold text-white/85">
              {whereLabel(r.where, hqName)}
            </span>
          </>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-white/45">
        <span className={r.stalled ? "font-semibold text-[#ffd84a]" : ""}>
          {r.stalled ? "멈춤 · " : ""}마지막 소식 {agoLabel(r.lastAt, now)}
        </span>
        {r.card && <span>카드 {r.card}</span>}
      </div>
      {r.note && (
        <p className="mt-1 text-[12px] break-words text-white/70">{r.note}</p>
      )}
      <details className="mt-1 text-[11.5px] text-white/45">
        <summary className="cursor-pointer select-none hover:text-white/70">
          지난 줄 {r.lines.length}
        </summary>
        <ol className="mt-1 space-y-0.5 pl-1">
          {r.lines.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 한 나르기의 줄은 시각순으로 덧붙기만 한다
            <li key={`${l.at}-${i}`} className="flex gap-2">
              <span className="w-16 shrink-0 tabular-nums text-white/35">
                {agoLabel(l.at, now)}
              </span>
              <span className="min-w-0 break-words text-white/60">
                {KIND_LABEL[l.kind]}
                {l.kind === "open" && l.from ? ` · ${l.from}` : ""}
                {l.kind === "forward" && l.to ? ` → ${l.to}` : ""}
                {l.note ? ` · ${l.note}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

function Unlinked({ line, now }: { line: RelayLine; now: number }) {
  return (
    <li className="flex items-baseline gap-2 py-1.5 text-[12.5px]">
      <span className="text-white/40">넘김 →</span>
      <span className="min-w-0 flex-1 truncate text-white/80">
        {line.to ?? "받는 세션 모름"}
      </span>
      <span className="shrink-0 text-[11.5px] text-white/40">
        {agoLabel(line.at, now)}
      </span>
    </li>
  );
}
