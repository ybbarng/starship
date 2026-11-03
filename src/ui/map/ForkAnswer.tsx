"use client";

// 지도 갈림길에 선실에서 바로 답하기(docs/map.md "갈림길에 답하기"). 깃발을 눌러 뜨는 창과 오른쪽 구역 판이 같이 쓴다.
// 답은 서버가 그 세션에 전하고, map.json은 세션이 고친다. 그 사이에는 "보냈어요"로 남는다.
// 보낸 답은 이 부품의 상태가 아니라 src/data/sent.ts에 둔다: 창을 닫았다 열어도, 구역 판에서 봐도 같게(2026-11-03).
// 본부가 받았을 때(ok)만 보낸 것으로 친다. 못 받았으면 단추와 쓴 글이 그대로 남아 다시 보낼 수 있다.
import { useEffect, useState } from "react";
import { useAct } from "@/data/hooks";
import { forkKey, useSent } from "@/data/sent";
import type { Sign } from "@/protocol/map";

type Fork = Extract<Sign, { type: "fork" }>;

export function ForkAnswer({
  crewId,
  region,
  sign,
}: {
  crewId: string;
  region: string;
  sign: Fork;
}) {
  const act = useAct();
  const key = forkKey(crewId, region, sign.id);
  const sent = useSent((s) => s.sent[key]);
  const mark = useSent((s) => s.mark);
  const clear = useSent((s) => s.clear);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  // 세션이 지도를 고쳐 갈림길이 정해지면(또는 다시 열리면) 보낸 표시를 지운다
  const open = sign.status === "open";
  useEffect(() => {
    if (!open) clear(key);
  }, [open, key, clear]);
  const options = [...(sign.options ?? [])].sort(
    (a, b) => Number(b === sign.recommend) - Number(a === sign.recommend),
  );
  const send = async (answer: string) => {
    if (sending) return;
    setSending(true);
    try {
      const result = await act.sign(crewId, region, sign.id, answer);
      if (!result.ok) return;
      mark(key, answer);
      setText("");
    } finally {
      setSending(false);
    }
  };
  // 이미 정해진 갈림길(깃발 창이 열린 채 세션이 지도를 고친 때)에는 단추를 다시 보이지 않는다
  if (!open)
    return (
      <p data-fork-decided className="mt-1.5 text-[12px] text-white/60">
        정했어요{sign.decided ? `: ${sign.decided}` : ""}
      </p>
    );
  if (sent)
    return (
      <p data-fork-sent className="mt-1.5 text-[12px] text-[#bff3d2]">
        “{sent}”로 세션에 전했어요. 세션이 지도를 고치면 깃발이 내려가요.
      </p>
    );
  return (
    <div
      data-fork-answer
      aria-busy={sending}
      className="mt-1.5 flex flex-col gap-1.5"
    >
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              data-fork-option={o}
              disabled={sending}
              onClick={() => void send(o)}
              className={`rounded-md border px-2 py-1 text-left text-[12px] transition disabled:opacity-50 ${
                o === sign.recommend
                  ? "border-[#ffd84a]/50 bg-[#ffd84a]/15 text-[#fff0b8] hover:bg-[#ffd84a]/25"
                  : "border-white/15 bg-white/[0.05] text-white/80 hover:bg-white/10"
              }`}
            >
              {o === sign.recommend && "★ "}
              {o}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void send(text.trim());
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            options.length ? "다르게 정하기(글로)" : "어떻게 할지 적기"
          }
          className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-white placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="rounded border border-white/15 px-2 text-[12px] text-white/75 hover:bg-white/10 disabled:opacity-40"
        >
          {sending ? "보내는 중…" : "보내기"}
        </button>
      </form>
    </div>
  );
}
