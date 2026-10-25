/** 도킹 시안 전용 애니메이션. 이름은 모두 `dk-`로 시작한다. */
export const DOCKING_CSS = `
.dk-flame { transform-origin: 20px 27px; animation: dk-flame .18s ease-in-out infinite alternate; }
@keyframes dk-flame { from { transform: scaleX(.75); opacity: .75 } to { transform: scaleX(1.15); opacity: 1 } }
.dk-blink { animation: dk-blink 1.4s steps(2, jump-none) infinite; }
@keyframes dk-blink { 0% { opacity: .25 } 100% { opacity: 1 } }

.dk-bob { animation: dk-bob 3.6s ease-in-out infinite; animation-delay: var(--d, 0s); }
@keyframes dk-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }

.dk-pulse { animation: dk-pulse 1.6s ease-in-out infinite; }
@keyframes dk-pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }

.dk-wait { animation: dk-wait 1.1s ease-in-out infinite; }
@keyframes dk-wait { 0%,100% { box-shadow: 0 0 0 0 rgba(255,207,92,0) } 50% { box-shadow: 0 0 0 3px rgba(255,207,92,.45) } }

.dk-clamp { animation: dk-clamp .9s cubic-bezier(.2,.9,.3,1.4) both; }
@keyframes dk-clamp {
  0% { transform: translateY(-10px) }
  45% { transform: translateY(3px) }
  65% { transform: translateY(-1px) }
  100% { transform: translateY(0) }
}
.dk-ring { animation: dk-ring 1.2s ease-out both; }
@keyframes dk-ring { 0% { transform: scale(.4); opacity: 1 } 100% { transform: scale(2.6); opacity: 0 } }
.dk-pop { animation: dk-pop 1.8s ease-out both; }
@keyframes dk-pop {
  0% { transform: translate(-50%, 6px) scale(.6); opacity: 0 }
  15% { transform: translate(-50%, -4px) scale(1.15); opacity: 1 }
  70% { transform: translate(-50%, -8px) scale(1); opacity: 1 }
  100% { transform: translate(-50%, -16px) scale(1); opacity: 0 }
}
.dk-tag-in { animation: dk-tag-in .6s ease-out both; animation-delay: .25s; }
@keyframes dk-tag-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }

.dk-dash { stroke-dasharray: 6 6; animation: dk-dash 1s linear infinite; }
@keyframes dk-dash { to { stroke-dashoffset: -12 } }

.dk-banner { animation: dk-banner .5s ease-out both; }
@keyframes dk-banner { from { opacity: 0; transform: translate(-50%, -12px) } to { opacity: 1; transform: translate(-50%, 0) } }

.dk-hatch-l { animation: dk-hatch-l .9s cubic-bezier(.6,0,.2,1) .15s both; }
.dk-hatch-r { animation: dk-hatch-r .9s cubic-bezier(.6,0,.2,1) .15s both; }
@keyframes dk-hatch-l { from { transform: translateX(0) } to { transform: translateX(-102%) } }
@keyframes dk-hatch-r { from { transform: translateX(0) } to { transform: translateX(102%) } }
.dk-hatch-body { animation: dk-tag-in .5s ease-out .55s both; }

.dk-drawer { animation: dk-drawer .35s ease-out both; }
@keyframes dk-drawer { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }

@media (prefers-reduced-motion: reduce) {
  .dk-flame, .dk-blink, .dk-bob, .dk-pulse, .dk-wait, .dk-dash { animation: none; }
}
`;
