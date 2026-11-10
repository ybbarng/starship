"use client";

// 보안 구역: AI 세션의 1Password CLI 신청서와 호출 기록. 1Password 팝업이 떴을 때 맨 위만 보고 승인할지 정한다.
// 아래는 전체 기록을 세션·사람/AI·기간으로 걸러 본다. 설명: docs/secure.md.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSecure } from "@/data/hooks";
import type { SecureLog, SecureResponse } from "@/protocol/secure";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import {
  activeRequests,
  type Filter,
  filterRequests,
  filterRows,
  groupCalls,
  latestRequest,
  PERIOD_LABEL,
  type Period,
  sessionsOf,
} from "@/secure/rows";
import { BigRequest, CallLine, RED, RequestLine, SmallRequest } from "./parts";

/** 남은 시간 글을 새로 그리는 간격 */
const TICK_MS = 5_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function SecurePage() {
  const query = useSecure();
  const data = query.data;
  return (
    <main className={`min-h-dvh text-white ${cockpit.panel}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/50 px-4 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <Link
          href="/"
          className="rounded px-2 py-1 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          ← 조종석으로
        </Link>
        <h1 className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[10px] font-semibold tracking-[0.3em] text-[#ff8f8f]/80">
            SECURE ZONE
          </span>
          <span className="text-[15px] font-semibold">보안 구역</span>
          <span className="text-[12px] text-white/45">
            · 1Password 신청서와 호출 기록
          </span>
        </h1>
        {data && <Source data={data} failed={query.isError} />}
      </header>

      {query.isLoading ? (
        <p className="p-6 text-white/55">기록을 읽는 중…</p>
      ) : !data ? (
        <p className="p-6 text-white/55">
          보안 기록을 읽지 못했어요 · {query.error?.message}
        </p>
      ) : data.status === "none" ? (
        <section className="mx-auto max-w-[760px] p-6">
          <p className="text-[15px]">본부에 보안 기록이 아직 없어요.</p>
          <p className="mt-1 text-[13px] text-white/50">
            비서 서버가 보안 기록을 내주기 시작하면 여기에 보여요.
          </p>
        </section>
      ) : (
        <Body log={data.log} />
      )}
      {data && query.isError && (
        <p className="px-4 pb-4 text-[12px] text-[#ffcf5c]">
          새로 읽지 못해 마지막으로 받은 기록을 보이고 있어요 ·{" "}
          {query.error?.message}
        </p>
      )}
    </main>
  );
}

function Source({ data, failed }: { data: SecureResponse; failed: boolean }) {
  return (
    <span className="ml-auto flex flex-wrap items-center gap-x-3 text-[11.5px] text-white/40">
      {data.source === "demo" ? (
        <span className="rounded bg-[#ffd84a]/15 px-1.5 py-0.5 font-semibold text-[#ffd84a]">
          데모 · 지어낸 기록이에요
        </span>
      ) : (
        <span>{failed ? "새로 읽지 못함" : "5초마다 새로 읽어요"}</span>
      )}
    </span>
  );
}

function Body({ log }: { log: SecureLog }) {
  const now = useNow();
  const rows = useMemo(() => groupCalls(log.calls), [log.calls]);
  const byId = useMemo(
    () => new Map(log.requests.map((r) => [r.id, r])),
    [log.requests],
  );
  const callsPer = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows)
      if (r.requestId) m.set(r.requestId, (m.get(r.requestId) ?? 0) + 1);
    return m;
  }, [rows]);
  const active = activeRequests(log.requests, now);
  const latest = latestRequest(log.requests);
  const others = active.filter((r) => r.id !== latest?.id);

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-5">
      <section data-secure-now className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold">
            지금 유효한 신청서 {active.length}개
          </span>
        </h2>
        {active.length === 0 && (
          <p
            className="rounded-lg border px-3 py-2 text-[13.5px]"
            style={{ borderColor: `${RED}55`, color: RED }}
          >
            지금 유효한 신청서가 없어요. 직접 부른 것이 아니라면 팝업을 승인하지
            마세요.
          </p>
        )}
        {latest && (
          <BigRequest
            r={latest}
            now={now}
            calls={callsPer.get(latest.id) ?? 0}
          />
        )}
        {others.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {others.map((r) => (
              <SmallRequest
                key={r.id}
                r={r}
                now={now}
                calls={callsPer.get(r.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      <History
        log={log}
        now={now}
        byId={byId}
        callsPer={callsPer}
        rows={rows}
      />

      {log.problems && (
        <details className="text-[12px] text-white/45">
          <summary className="cursor-pointer">
            형식이 틀려 뺀 기록 {log.problems.length}건
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 pl-4 font-mono [overflow-wrap:anywhere]">
            {log.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type Tab = "calls" | "requests";
const ACTOR_LABEL: Record<Filter["actor"], string> = {
  all: "모두",
  ai: "AI",
  human: "직접 실행",
};

function Segments<T extends string>({
  value,
  options,
  labels,
  onChange,
  name,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset
      aria-label={name}
      className="flex min-w-0 gap-0.5 rounded-md bg-white/[0.04] p-0.5 text-[12.5px]"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`rounded px-2.5 py-1 ${
            value === o
              ? "bg-white/[0.12] font-semibold"
              : "text-white/55 hover:text-white"
          }`}
        >
          {labels[o]}
        </button>
      ))}
    </fieldset>
  );
}

function History({
  log,
  now,
  byId,
  callsPer,
  rows,
}: {
  log: SecureLog;
  now: number;
  byId: Map<string, SecureLog["requests"][number]>;
  callsPer: Map<string, number>;
  rows: ReturnType<typeof groupCalls>;
}) {
  const [tab, setTab] = useState<Tab>("calls");
  const [filter, setFilter] = useState<Filter>({
    actor: "all",
    period: "today",
  });
  const sessions = useMemo(
    () => sessionsOf(log.requests, log.calls),
    [log.requests, log.calls],
  );
  const shownRows = filterRows(rows, filter, now);
  const shownReqs = filterRequests(log.requests, filter, now);
  const redCount = shownRows.filter((r) => r.alerts.length).length;

  return (
    <section data-secure-history className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold">기록</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Segments
          name="보기"
          value={tab}
          options={["calls", "requests"] as const}
          labels={{
            calls: `호출 ${shownRows.length}`,
            requests: `신청서 ${shownReqs.length}`,
          }}
          onChange={setTab}
        />
        <Segments
          name="기간"
          value={filter.period}
          options={["1h", "today", "7d", "all"] as const}
          labels={PERIOD_LABEL}
          onChange={(period: Period) => setFilter((f) => ({ ...f, period }))}
        />
        <Segments
          name="누가"
          value={filter.actor}
          options={["all", "ai", "human"] as const}
          labels={ACTOR_LABEL}
          onChange={(actor) => setFilter((f) => ({ ...f, actor }))}
        />
        <select
          aria-label="세션"
          value={filter.session ?? ""}
          onChange={(e) =>
            setFilter((f) => ({ ...f, session: e.target.value || undefined }))
          }
          className="max-w-full rounded-md border border-white/10 bg-[#0d1118] px-2 py-1 text-[12.5px] text-white/80"
        >
          <option value="">모든 세션</option>
          {sessions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {tab === "calls" && redCount > 0 && (
        <p className="text-[12.5px] font-semibold" style={{ color: RED }}>
          빨간 줄로 표시한 살펴볼 호출이 {redCount}건 있어요.
        </p>
      )}
      <ul
        className={`overflow-hidden rounded-lg border border-white/[0.08] ${cockpit.bay}`}
      >
        {tab === "calls" ? (
          shownRows.length ? (
            shownRows.map((row) => (
              <CallLine
                key={row.key}
                row={row}
                now={now}
                request={row.requestId ? byId.get(row.requestId) : undefined}
              />
            ))
          ) : (
            <li className="px-3 py-4 text-[13px] text-white/45">
              이 조건에 맞는 호출이 없어요.
            </li>
          )
        ) : shownReqs.length ? (
          shownReqs.map((r) => (
            <RequestLine
              key={r.id}
              r={r}
              now={now}
              calls={callsPer.get(r.id) ?? 0}
            />
          ))
        ) : (
          <li className="px-3 py-4 text-[13px] text-white/45">
            {filter.actor === "human"
              ? "신청서는 AI 세션만 써요."
              : "이 조건에 맞는 신청서가 없어요."}
          </li>
        )}
      </ul>
    </section>
  );
}
