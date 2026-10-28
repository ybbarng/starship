"use client";

// 선실 오른쪽 판: 고른 구역의 요약·다음 일·표지·링크.
// 링크의 path는 저장소 안 파일이라 화면에서 열지 않고 경로만 보인다.
import {
  isForkForMe,
  isNewFound,
  type ProjectMap,
  type Region,
  type Sign,
} from "@/protocol/map";
import {
  ownerLabel,
  REGION_STATUS_COLOR,
  REGION_STATUS_LABEL,
  SIGN_ICON,
  SIGN_LABEL,
  TALK_STATUS_LABEL,
} from "./labels";

export function RegionPanel({
  map,
  region,
  dropped,
  now,
}: {
  map: ProjectMap;
  region: Region;
  dropped: boolean;
  now: number;
}) {
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const path: string[] = [];
  for (
    let p = region.parent ? byId.get(region.parent) : undefined, i = 0;
    p && i < 4;
    p = p.parent ? byId.get(p.parent) : undefined, i++
  )
    path.unshift(p.title);
  const status = dropped ? "dropped" : region.status;
  const signs = region.signs ?? [];
  const kids = map.regions.filter((r) => r.parent === region.id);
  return (
    <div data-region-panel className="flex flex-col gap-4 text-[13px]">
      <div>
        {path.length > 0 && (
          <div className="truncate text-[11px] text-white/40">
            {path.join(" › ")}
          </div>
        )}
        <h2 className="text-[17px] leading-snug font-semibold text-white">
          {region.title}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/60">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: REGION_STATUS_COLOR[status] }}
            />
            {REGION_STATUS_LABEL[status]}
          </span>
          {region.since && <span>· {region.since}부터</span>}
          <span>· 크기 {region.size}</span>
          {map.here === region.id && (
            <span className="text-[#7ce0ff]">· 지금 여기</span>
          )}
        </div>
        {region.found && (
          <div className="mt-1 text-[12px] text-[#7ce0ff]/85">
            {isNewFound(region, now) ? "새 땅 · " : ""}
            {region.found}에 발견(처음 계획에 없던 구역)
          </div>
        )}
      </div>

      {region.summary && (
        <p className="leading-relaxed text-white/80">{region.summary}</p>
      )}
      {region.next && (
        <Field label="다음">
          <p className="text-white/90">{region.next}</p>
        </Field>
      )}

      {kids.length > 0 && (
        <Field label={`안의 구역 ${kids.length}`}>
          <ul className="flex flex-wrap gap-1">
            {kids.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.5 text-[12px] text-white/75"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: REGION_STATUS_COLOR[k.status] }}
                />
                {k.title}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {signs.length > 0 && (
        <Field label="표지">
          <ul className="flex flex-col gap-2">
            {signs.map((s) => (
              <SignItem key={s.id} sign={s} />
            ))}
          </ul>
        </Field>
      )}

      {region.links && region.links.length > 0 && (
        <Field label="링크">
          <ul className="flex flex-col gap-1">
            {region.links.map((l) => (
              <li key={`${l.label}-${l.path ?? l.url}`} className="min-w-0">
                {l.url ? (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-glow-work underline-offset-2 hover:underline"
                  >
                    {l.label} ↗
                  </a>
                ) : (
                  <span className="text-white/80">{l.label}</span>
                )}
                {l.path && (
                  <code className="ml-2 font-mono text-[11px] break-all text-white/45">
                    {l.path}
                  </code>
                )}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-[10.5px] font-semibold tracking-[0.18em] text-white/35">
        {label}
      </h3>
      {children}
    </section>
  );
}

function SignItem({ sign }: { sign: Sign }) {
  const mine = isForkForMe(sign);
  return (
    <li
      data-sign={sign.type}
      className={`rounded-md border px-2.5 py-2 ${
        mine
          ? "border-[#ffcf5c]/60 bg-[#ffcf5c]/[0.08]"
          : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="w-4 shrink-0 text-center">{SIGN_ICON[sign.type]}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white/90">{sign.title}</div>
          <div className="mt-0.5 text-[12px] text-white/55">
            {sign.type === "fork" &&
              (sign.status === "decided"
                ? `${SIGN_LABEL.fork} · 정함${sign.decided ? `: ${sign.decided}` : ""}`
                : `${SIGN_LABEL.fork} · ${ownerLabel(sign.owner)} 정할 것`)}
            {sign.type === "talk" &&
              `${SIGN_LABEL.talk} · ${sign.with} — ${TALK_STATUS_LABEL[sign.status]}`}
            {sign.type === "risk" && SIGN_LABEL.risk}
          </div>
          {sign.type === "fork" &&
            sign.status === "open" &&
            sign.options &&
            sign.options.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {sign.options.map((o) => (
                  <li
                    key={o}
                    className={`rounded px-1.5 py-0.5 text-[12px] ${
                      o === sign.recommend
                        ? "bg-[#5ee08a]/15 text-[#bff3d2]"
                        : "bg-white/[0.06] text-white/70"
                    }`}
                  >
                    {o}
                    {o === sign.recommend && " · 추천"}
                  </li>
                ))}
              </ul>
            )}
          {sign.type === "talk" && sign.path && (
            <code className="mt-1 block font-mono text-[11px] break-all text-white/40">
              {sign.path}
            </code>
          )}
        </div>
      </div>
    </li>
  );
}
