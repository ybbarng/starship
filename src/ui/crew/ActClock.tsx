"use client";

import { useEffect, useRef } from "react";
import {
  type Act,
  durationOf,
  gapFor,
  hashSeed,
  makeRandom,
  type Plan,
  pickAct,
  type Traits,
} from "./acts";

interface Props {
  pose: "work" | "wave" | "sleep" | "walk" | "stand" | "off";
  traits: Traits;
  seed: string;
  urgency: number;
  tempo: number;
  /** 확인판용: 이 동작만 되풀이한다. */
  act?: Act;
}

/**
 * 동물 하나에 타이머 하나. 그림은 건드리지 않고 svg 뿌리에 `data-act`만 바꿔
 * CSS가 그 동작을 한 번 재생하게 한다. 데이터가 다시 와서 다시 그려져도
 * 자세·동물이 그대로면 일정은 이어진다.
 */
export function ActClock({ pose, traits, seed, urgency, tempo, act }: Props) {
  const ref = useRef<SVGGElement>(null);
  const live = useRef({ urgency, seed });
  live.current.urgency = urgency;

  const { kind, hasEars, hasTail, furniture } = traits;
  useEffect(() => {
    const root = ref.current?.ownerSVGElement;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const t: Traits = { kind, hasEars, hasTail, furniture };
    const rnd = makeRandom(hashSeed(`${live.current.seed}|${pose}`));
    let timer = 0;
    let last: Act | null = null;

    const rest = (ms: number) => {
      delete root.dataset.act;
      timer = window.setTimeout(play, ms);
    };
    const play = () => {
      const u = live.current.urgency;
      const plan: Plan | null = act
        ? { act, ms: durationOf(act) }
        : pickAct(pose, t, u, rnd, last);
      if (!plan) return;
      last = plan.act;
      root.style.setProperty("--act-dur", `${plan.ms}ms`);
      root.dataset.act = plan.act;
      timer = window.setTimeout(
        () => rest(act ? 700 : gapFor(pose, u, tempo, rnd)),
        plan.ms,
      );
    };

    // 처음엔 동물마다 다른 때에 시작한다. 부름은 금방 시작해 눈길을 끈다.
    const first = pose === "wave" ? 200 + rnd() * 900 : 600 + rnd() * 5000;
    rest(act ? 300 : first);
    return () => {
      window.clearTimeout(timer);
      delete root.dataset.act;
    };
  }, [pose, kind, hasEars, hasTail, furniture, tempo, act]);

  return <g ref={ref} />;
}
