/** 내부 층 전용 애니메이션. 이름은 모두 `ib-`로 시작한다. */
export const INTERIOR_CSS = `
.ib-flame { transform-origin: 20px 27px; animation: ib-flame .18s ease-in-out infinite alternate; }
@keyframes ib-flame { from { transform: scaleX(.75); opacity: .75 } to { transform: scaleX(1.15); opacity: 1 } }
.ib-thrust { transform-box: fill-box; transform-origin: 50% 0%; animation: ib-thrust .14s ease-in-out infinite alternate; }
@keyframes ib-thrust { from { transform: scaleY(.8); opacity: .7 } to { transform: scaleY(1.12); opacity: 1 } }
.ib-blink { animation: ib-blink 1.4s steps(2, jump-none) infinite; }
@keyframes ib-blink { 0% { opacity: .25 } 100% { opacity: 1 } }
.ib-pulse { animation: ib-pulse 2.4s ease-in-out infinite; }
@keyframes ib-pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
.ib-core { transform-box: fill-box; transform-origin: 50% 50%; animation: ib-core 3s ease-in-out infinite; }
@keyframes ib-core { 0%,100% { transform: scaleX(.9); opacity: .75 } 50% { transform: scaleX(1.05); opacity: 1 } }
.ib-bob { animation: ib-bob 3.6s ease-in-out infinite; animation-delay: var(--d, 0s); }
@keyframes ib-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
.ib-wait { animation: ib-wait 1.2s ease-in-out infinite; }
@keyframes ib-wait { 0%,100% { box-shadow: 0 0 0 0 rgba(255,207,92,0) } 50% { box-shadow: 0 0 0 3px rgba(255,207,92,.5) } }
.ib-steam { animation: ib-steam 2.6s ease-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes ib-steam { 0% { transform: translateY(0) scale(.6); opacity: 0 } 30% { opacity: .6 } 100% { transform: translateY(-10px) scale(1.2); opacity: 0 } }
.ib-scan { animation: ib-scan 4s linear infinite; }
@keyframes ib-scan { from { transform: translateY(-100%) } to { transform: translateY(100%) } }
.ib-dock { animation: ib-dock 1.6s cubic-bezier(.2,.8,.3,1) both; }
@keyframes ib-dock {
  0% { transform: translateX(-240px); opacity: 0 }
  20% { opacity: 1 }
  80% { transform: translateX(4px) }
  100% { transform: translateX(0) }
}
.ib-drawer { animation: ib-drawer .3s ease-out both; }
@keyframes ib-drawer { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }

/* 해치: 잠금 바퀴가 돌고, 두 문이 위아래로 갈라진다 */
.ib-wheel { animation: ib-wheel .55s cubic-bezier(.5,0,.3,1) both; transform-box: fill-box; transform-origin: 50% 50%; }
@keyframes ib-wheel { from { transform: rotate(0) } to { transform: rotate(-200deg) } }
.ib-door-t { animation: ib-door-t .8s cubic-bezier(.6,0,.2,1) .55s both; }
.ib-door-b { animation: ib-door-b .8s cubic-bezier(.6,0,.2,1) .55s both; }
@keyframes ib-door-t { from { transform: translateY(0) } to { transform: translateY(-103%) } }
@keyframes ib-door-b { from { transform: translateY(0) } to { transform: translateY(103%) } }
.ib-wheel-out { animation: ib-wheel-out .8s cubic-bezier(.6,0,.2,1) .55s both; }
@keyframes ib-wheel-out { from { transform: translateY(0) } to { transform: translateY(-140px) } }
.ib-hiss { animation: ib-hiss 1s ease-out .6s both; }
@keyframes ib-hiss { 0% { opacity: 0; transform: scaleX(.2) } 30% { opacity: .9 } 100% { opacity: 0; transform: scaleX(1.6) } }
.ib-hatch-body { animation: ib-in .45s ease-out 1s both; }
@keyframes ib-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  .ib-flame, .ib-thrust, .ib-blink, .ib-pulse, .ib-core, .ib-bob, .ib-wait, .ib-steam, .ib-scan { animation: none; }
}
`;
