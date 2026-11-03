"use client";

// 연료 기록: 토큰 사용량을 기간(오늘·7일·30일)마다 업무·개인 합계, 프로젝트·세션 순위로 본다. 설계: docs/usage.md.
// 캐시 읽기가 출력의 수백 배라 한 줄 합계로 보이면 오해하니, 입력·캐시 쓰기·캐시 읽기·출력을 늘 나눠 적는다.
import Link from "next/link";
import { useState } from "react";
import { useBridge, useUsage } from "@/data/hooks";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import {
  AREA_LABEL,
  type Area,
  type ProjectUsage,
  RANGE_LABEL,
  type Totals,
  type UsageRange,
  type UsageResponse,
} from "@/usage/model";
import { WeeklyFuelBand } from "./WeeklyFuel";

const AREA_COLOR: Record<Area, string> = {
  work: "#6aa8ff",
  personal: "#ffb45c",
  other: "#8792a8",
};

type SortKey = "output" | "cost" | "cacheRead" | "requests";
const SORT_LABEL: Record<SortKey, string> = {
  output: "출력",
  cost: "추정 비용",
  cacheRead: "캐시 읽기",
  requests: "요청",
};

/** 1,234 · 1.2만 · 1,850만 · 86.2억 */
export function tokens(n: number): string {
  if (n < 10_000) return n.toLocaleString("ko-KR");
  if (n < 100_000_000) {
    const man = n / 10_000;
    return `${man < 100 ? man.toFixed(1) : Math.round(man).toLocaleString("ko-KR")}만`;
  }
  return `${(n / 100_000_000).toFixed(1)}억`;
}

export function usd(n: number): string {
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function ago(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.round(s / 60)}분 전`;
  return `${Math.round(s / 3600)}시간 전`;
}

function when(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function UsagePage() {
  const [range, setRange] = useState<UsageRange>("7d");
  const query = useUsage(range);
  const [refreshing, setRefreshing] = useState(false);
  const data = query.data;
  return (
    <main className={`min-h-dvh text-white ${cockpit.panel}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/50 px-4 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <Link
          href="/fuel"
          className="rounded px-2 py-1 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          ← 연료실로
        </Link>
        <h1 className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold tracking-[0.3em] text-[#ffb45c]/80">
            FUEL LOG BOOK
          </span>
          <span className="text-[15px] font-semibold">연료 기록 노트</span>
          <span className="text-[12px] text-white/45">
            · 항해 일지(토큰 사용량)
          </span>
        </h1>
        <div
          data-usage-ranges
          className="flex gap-1 rounded-md bg-white/[0.04] p-0.5 text-[12.5px]"
        >
          {(["today", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              data-range={r}
              onClick={() => setRange(r)}
              className={`rounded px-3 py-1 ${
                range === r
                  ? "bg-white/[0.12] font-semibold"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        {data && (
          <Meta
            data={data}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetch(`/api/usage?range=${range}&fresh=1`, {
                cache: "no-store",
              }).catch(() => undefined);
              await query.refetch();
              setRefreshing(false);
            }}
          />
        )}
      </header>

      {query.isLoading ? (
        <p className="p-8 text-white/55">
          기록을 읽는 중… 처음 한 번은 기록이 많아 수십 초 걸릴 수 있어요.
        </p>
      ) : query.error && !data ? (
        <p className="p-8 text-white/55">
          사용량을 읽지 못했어요 · {String(query.error.message)}
        </p>
      ) : data ? (
        <Body data={data} />
      ) : null}
    </main>
  );
}

function Meta({
  data,
  refreshing,
  onRefresh,
}: {
  data: UsageResponse;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const m = data.meta;
  return (
    <span className="ml-auto flex flex-wrap items-center gap-x-3 text-[11.5px] text-white/40">
      {m.source === "demo" ? (
        <span className="rounded bg-[#ffd84a]/15 px-1.5 py-0.5 font-semibold text-[#ffd84a]">
          데모 · 지어낸 숫자예요
        </span>
      ) : (
        <span
          title={`기록 파일 ${m.files}개, 합계 칸 ${m.buckets.toLocaleString("ko-KR")}개를 남겨 두었어요. 5분보다 자주 다시 읽지 않아요`}
        >
          기록 {ago(m.scannedAt, data.to)}에 읽음 · {m.scanMs}ms
        </span>
      )}
      {m.source === "local" && (
        <button
          type="button"
          data-usage-fresh
          disabled={refreshing}
          onClick={onRefresh}
          className="rounded px-1.5 py-0.5 text-white/55 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {refreshing ? "읽는 중…" : "다시 읽기"}
        </button>
      )}
      {!m.rules && (
        <span
          className="text-[#ffb45c]"
          title="STARSHIP_USAGE_AREAS를 정하면 업무·개인으로 나눠요"
        >
          업무·개인 규칙이 없어 모두 기타예요
        </span>
      )}
    </span>
  );
}

function Body({ data }: { data: UsageResponse }) {
  const [area, setArea] = useState<Area | "all">("all");
  const [sort, setSort] = useState<SortKey>("output");
  const [open, setOpen] = useState<string | null>(null);
  const bridge = useBridge();
  const projects = data.projects
    .filter((p) => area === "all" || p.area === area)
    .sort((a, b) => b[sort] - a[sort]);
  const top = projects[0]?.[sort] ?? 0;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-5">
      <WeeklyFuelBand />
      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        data-usage-areas
      >
        <AreaCard label="합계" color="#e8edf7" t={data.total} />
        {(["work", "personal", "other"] as const).map((a) => (
          <AreaCard
            key={a}
            label={AREA_LABEL[a]}
            color={AREA_COLOR[a]}
            t={data.areas[a]}
            share={
              data.total.output ? data.areas[a].output / data.total.output : 0
            }
          />
        ))}
      </section>

      {data.days.length > 1 && <Days data={data} />}

      <section data-usage-projects>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/55">
          <h2 className="text-[10.5px] font-semibold tracking-[0.18em] text-white/40">
            승무원별 연료 소비 {projects.length}
          </h2>
          <Pills
            value={area}
            options={[
              ["all", "전체"],
              ["work", "업무"],
              ["personal", "개인"],
              ["other", "기타"],
            ]}
            onChange={setArea}
          />
          <span className="ml-auto flex items-center gap-2">
            정렬
            <Pills
              value={sort}
              options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => [
                k,
                SORT_LABEL[k],
              ])}
              onChange={setSort}
            />
          </span>
        </div>
        <div className={`overflow-x-auto rounded-lg ${cockpit.bay}`}>
          <table className="w-full min-w-[860px] text-[12.5px] tabular-nums">
            <thead className="bg-white/[0.03] text-[11px] text-white/45">
              <tr>
                <th className="w-8 px-2 py-1.5 text-right font-normal">#</th>
                <th className="px-2 py-1.5 text-left font-normal">프로젝트</th>
                <th className="px-2 py-1.5 text-right font-normal">세션</th>
                <th className="px-2 py-1.5 text-right font-normal">요청</th>
                <th className="px-2 py-1.5 text-right font-normal">입력</th>
                <th className="px-2 py-1.5 text-right font-normal">
                  캐시 쓰기
                </th>
                <th className="px-2 py-1.5 text-right font-normal">
                  캐시 읽기
                </th>
                <th className="px-2 py-1.5 text-right font-normal">출력</th>
                <th className="px-2 py-1.5 text-right font-normal">
                  추정 비용
                </th>
                <th className="w-[140px] px-2 py-1.5 font-normal" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <ProjectRows
                  key={p.key}
                  p={p}
                  rank={i + 1}
                  bar={top ? p[sort] / top : 0}
                  open={open === p.key}
                  onToggle={() => setOpen((k) => (k === p.key ? null : p.key))}
                  cabin={bridge.crewById.has(p.name) ? p.name : undefined}
                  now={data.to}
                />
              ))}
              {projects.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-6 text-center text-white/40"
                  >
                    이 기간에 쓴 것이 없어요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Models data={data} />
        <Limits />
      </div>
    </div>
  );
}

/**
 * 연료 탱크 하나(합계·업무·개인·기타). 왼쪽 세로 게이지가 출력(추진 연소) 몫만큼 찬다.
 * 우주선 말 옆에 원래 말(출력·입력·캐시 쓰기·캐시 읽기)을 작게 함께 적어 숫자의 뜻을 놓치지 않게 한다.
 */
function AreaCard({
  label,
  color,
  t,
  share,
}: {
  label: string;
  color: string;
  t: Totals;
  share?: number;
}) {
  const level = share ?? 1;
  const row = (name: string, plain: string, v: number, hint?: string) => (
    <div className="flex justify-between gap-2" title={hint}>
      <span className="text-white/50">
        {name} <span className="text-white/30">{plain}</span>
      </span>
      <span className="text-white/80">{tokens(v)}</span>
    </div>
  );
  return (
    <div
      data-area-card={label}
      className={`flex gap-3 rounded-lg px-3 py-3 ${cockpit.bay}`}
    >
      {/* 탱크 게이지: 눈금 네 칸, 아래부터 찬다 */}
      <div
        className="relative w-[18px] shrink-0 overflow-hidden rounded-[5px] border border-white/15 bg-black/40"
        title={`출력의 ${Math.round(level * 100)}%`}
      >
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-700"
          style={{
            height: `${Math.max(2, level * 100)}%`,
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            boxShadow: `0 0 10px ${color}66`,
          }}
        />
        {[25, 50, 75].map((y) => (
          <div
            key={y}
            className="absolute inset-x-0 h-px bg-black/50"
            style={{ bottom: `${y}%` }}
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold" style={{ color }}>
            {label} 탱크
          </span>
          {share !== undefined && (
            <span className="font-mono text-[11px] text-white/45">
              {Math.round(share * 100)}%
            </span>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-[24px] font-semibold tabular-nums">
            {tokens(t.output)}
          </span>
          <span className="text-[11.5px] text-white/45">추진 연소(출력)</span>
        </div>
        <div className="text-[12px] text-white/60 tabular-nums">
          연료비 추정 {usd(t.cost)} · 점화 {t.requests.toLocaleString("ko-KR")}
          번
        </div>
        <div className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2 text-[11.5px] tabular-nums">
          {row("신선 연료", "입력", t.input, "캐시를 거치지 않은 입력")}
          {row(
            "연료 저장",
            "캐시 쓰기",
            t.cacheWrite,
            "다음 요청을 위해 캐시에 적은 입력",
          )}
          {row(
            "재순환 연료",
            "캐시 읽기",
            t.cacheRead,
            "캐시에서 다시 읽은 입력. 값이 싸서 토큰 수는 크다",
          )}
          {row("추진 연소", "출력", t.output)}
        </div>
      </div>
    </div>
  );
}

function Days({ data }: { data: UsageResponse }) {
  const max = Math.max(
    1,
    ...data.days.map((d) => d.work + d.personal + d.other),
  );
  return (
    <section data-usage-days>
      <h2 className="mb-2 text-[10.5px] font-semibold tracking-[0.18em] text-white/40">
        항해 일지 · 날마다 추진 연소(출력)
      </h2>
      <div
        className={`flex h-[130px] items-end gap-[3px] rounded-lg border border-white/10 px-3 pt-3 pb-1 ${cockpit.screen}`}
      >
        {data.days.map((d) => {
          const sum = d.work + d.personal + d.other;
          return (
            <div
              key={d.day}
              className="flex min-w-0 flex-1 flex-col items-stretch"
              title={`${d.day} · 업무 ${tokens(d.work)} · 개인 ${tokens(d.personal)} · 기타 ${tokens(d.other)}`}
            >
              <div
                className="flex flex-col-reverse"
                style={{ height: `${(sum / max) * 92}px` }}
              >
                {(["work", "personal", "other"] as const).map((a) =>
                  d[a] > 0 ? (
                    <div
                      key={a}
                      style={{
                        height: `${(d[a] / sum) * 100}%`,
                        background: AREA_COLOR[a],
                      }}
                      className="opacity-80"
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-1 truncate text-center text-[9.5px] text-white/35">
                {d.day.slice(8)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProjectRows({
  p,
  rank,
  bar,
  open,
  onToggle,
  cabin,
  now,
}: {
  p: ProjectUsage;
  rank: number;
  bar: number;
  open: boolean;
  onToggle: () => void;
  cabin?: string;
  now: number;
}) {
  return (
    <>
      <tr
        data-project={p.name}
        onClick={onToggle}
        className="cursor-pointer border-t border-white/[0.05] hover:bg-white/[0.03]"
      >
        <td className="px-2 py-1.5 text-right text-white/35">{rank}</td>
        <td className="px-2 py-1.5" title={p.path ?? p.key}>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: AREA_COLOR[p.area] }}
            />
            <span className="truncate text-white/90">{p.name}</span>
            <span className="text-[10.5px] text-white/30">
              {open ? "▾" : "▸"}
            </span>
            {cabin && (
              <Link
                href={`/crew/${encodeURIComponent(cabin)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-[#7ce0ff]/80 hover:text-[#7ce0ff]"
              >
                선실
              </Link>
            )}
          </span>
        </td>
        <td className="px-2 py-1.5 text-right text-white/60">
          {p.sessions.length}
        </td>
        <td className="px-2 py-1.5 text-right text-white/60">
          {p.requests.toLocaleString("ko-KR")}
        </td>
        <td className="px-2 py-1.5 text-right text-white/50">
          {tokens(p.input)}
        </td>
        <td className="px-2 py-1.5 text-right text-white/50">
          {tokens(p.cacheWrite)}
        </td>
        <td className="px-2 py-1.5 text-right text-white/50">
          {tokens(p.cacheRead)}
        </td>
        <td className="px-2 py-1.5 text-right font-semibold text-white/90">
          {tokens(p.output)}
        </td>
        <td className="px-2 py-1.5 text-right text-white/75">{usd(p.cost)}</td>
        <td className="px-2 py-1.5">
          <LedGauge level={bar} color={AREA_COLOR[p.area]} />
        </td>
      </tr>
      {open &&
        p.sessions.slice(0, 20).map((s) => (
          <tr
            key={s.id}
            data-session={s.id}
            className="bg-white/[0.015] text-[11.5px]"
          >
            <td />
            <td className="py-1 pr-2 pl-6 text-white/55" title={s.id}>
              <code className="text-white/70">{s.id.slice(0, 8)}</code>{" "}
              <span className="text-white/35">
                {when(s.first)} ~ {when(s.last)}
                {now - s.last < 10 * 60_000 && (
                  <span className="ml-1 text-[#5ee08a]">지금 일하는 중</span>
                )}
              </span>
            </td>
            <td />
            <td className="px-2 py-1 text-right text-white/50">
              {s.requests.toLocaleString("ko-KR")}
            </td>
            <td className="px-2 py-1 text-right text-white/40">
              {tokens(s.input)}
            </td>
            <td className="px-2 py-1 text-right text-white/40">
              {tokens(s.cacheWrite)}
            </td>
            <td className="px-2 py-1 text-right text-white/40">
              {tokens(s.cacheRead)}
            </td>
            <td className="px-2 py-1 text-right text-white/75">
              {tokens(s.output)}
            </td>
            <td className="px-2 py-1 text-right text-white/60">
              {usd(s.cost)}
            </td>
            <td />
          </tr>
        ))}
      {open && p.sessions.length > 20 && (
        <tr className="bg-white/[0.015] text-[11px] text-white/35">
          <td />
          <td colSpan={9} className="py-1 pl-6">
            세션 {p.sessions.length - 20}개 더 있어요(출력이 작은 순)
          </td>
        </tr>
      )}
    </>
  );
}

function Models({ data }: { data: UsageResponse }) {
  return (
    <section>
      <h2 className="mb-2 text-[10.5px] font-semibold tracking-[0.18em] text-white/40">
        엔진별(모델)
      </h2>
      <table className="w-full text-[12px] tabular-nums">
        <tbody>
          {data.models.map((m) => (
            <tr key={m.model} className="border-t border-white/[0.05]">
              <td className="py-1 text-white/75">
                <code>{m.model}</code>
              </td>
              <td className="py-1 text-right text-white/50">
                요청 {m.requests.toLocaleString("ko-KR")}
              </td>
              <td className="py-1 text-right text-white/80">
                출력 {tokens(m.output)}
              </td>
              <td className="py-1 text-right text-white/60">
                {m.cost === undefined ? "가격 모름" : usd(m.cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Limits() {
  return (
    <section
      data-usage-limits
      className="rounded-md border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12px] leading-relaxed text-white/60"
    >
      <h2 className="mb-1.5 text-[10.5px] font-semibold tracking-[0.18em] text-white/40">
        계기 읽는 법
      </h2>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          토큰 수는 API 응답에 적힌 값이라 정확해요. 한 요청이 기록에 여러 줄로
          남아서 요청마다 마지막 줄 하나만 셉니다.
        </li>
        <li>
          캐시 읽기가 출력의 수백 배로 커요. 다시 읽은 대화 앞부분이 요청마다
          다시 세어져서 그래요. 그래서 네 가지를 한데 더하지 않고 나눠 적었어요.
        </li>
        <li>
          추정 비용은 API 가격으로 셈한 값이에요. 구독의 사용 한도(%)와는 맞지
          않아요. 한도 계산법은 공개되지 않았어요.
        </li>
        <li>
          이 맥북의 기록만 셉니다. 지운 세션, 웹이나 다른 기기에서 쓴 것은
          빠져요. 계정을 바꾼 날(2026-11-01) 앞뒤 기록이 섞여 있고, 기록에는
          계정을 나눌 값이 없어요.
        </li>
        <li>
          서브에이전트는 부모 세션에 더하고, 다른 폴더(worktree)에서 돌았어도
          기록이 놓인 프로젝트로 묶어요. 기록 파일을 다른 폴더로 복사해 둔 것은
          한 번만 세요.
        </li>
        <li>
          맥북을 붙잡지 않으려고 기록은 이 화면이 물을 때만, 5분보다 자주 읽지
          않아요. 지금 숫자가 필요하면 "다시 읽기"를 누르세요.
        </li>
      </ul>
    </section>
  );
}

function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <span className="flex gap-0.5 rounded bg-white/[0.04] p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded px-2 py-0.5 ${
            value === v
              ? "bg-white/[0.12] text-white"
              : "text-white/50 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/** 계기판 LED 막대: 10칸 가운데 몫만큼 켠다(가장 많이 쓴 승무원이 10칸). */
function LedGauge({ level, color }: { level: number; color: string }) {
  const lit = Math.max(level > 0 ? 1 : 0, Math.round(level * 10));
  return (
    <div className="flex gap-[2px]" title={`${Math.round(level * 100)}%`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 칸 자리가 곧 열쇠다
          key={i}
          className="h-[8px] flex-1 rounded-[1px]"
          style={
            i < lit
              ? { background: color, boxShadow: `0 0 4px ${color}aa` }
              : { background: "rgba(255,255,255,0.06)" }
          }
        />
      ))}
    </div>
  );
}
