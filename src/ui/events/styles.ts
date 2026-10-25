/**
 * 이벤트 층 전용 애니메이션. 전역 CSS를 건드리지 않도록 층 안의 <style>로 넣는다.
 * 이름은 모두 `ev-`로 시작해 다른 스타일과 섞이지 않는다.
 */
export const EVENT_CSS = `
.ev-band { position: absolute; left: 0; right: 0; top: 0; height: 75%; overflow: hidden; }
.ev-track { position: absolute; inset: 0; will-change: transform; }
.ev-actor { position: absolute; left: 0; }
.ev-cross { animation: ev-cross var(--dur) linear both; }
.ev-still { animation: ev-fade var(--dur) ease both; }
.ev-fade { animation: ev-fade var(--dur) ease both; }

.ev-poke {
  pointer-events: auto; cursor: pointer; display: block; width: 100%; height: 100%;
  padding: 0; margin: 0; border: 0; background: none; color: inherit; border-radius: 40%;
  -webkit-tap-highlight-color: transparent;
}
.ev-poke:focus { outline: none; }
.ev-poke:focus-visible { outline: 1px dashed rgba(255,255,255,.35); outline-offset: 4px; }
.ev-poke svg { display: block; overflow: visible; }

.ev-bubble {
  position: absolute; z-index: 2; white-space: nowrap; pointer-events: none;
  padding: 4px 10px; border-radius: 12px; font-size: 12.5px; line-height: 1.35; font-weight: 600;
  color: #1f2333; background: rgba(248,249,255,.94);
  box-shadow: 0 4px 14px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.4) inset;
  animation: ev-pop .35s cubic-bezier(.2,1.6,.4,1) both;
}
.ev-bubble::after {
  content: ""; position: absolute; left: 14px; bottom: -5px; width: 10px; height: 10px;
  background: inherit; transform: rotate(45deg); border-radius: 2px;
}
.ev-bubble.ev-tail-right::after { left: auto; right: 14px; }
.ev-sigh { animation: ev-sigh 7s ease-in-out infinite both; }

.ev-label {
  position: absolute; top: 10px; left: 14px; pointer-events: none;
  font-size: 12px; letter-spacing: .02em; color: rgba(200,208,224,.62);
  text-shadow: 0 1px 2px rgba(0,0,0,.6);
  animation: ev-label 5.5s ease both;
}
.ev-label::before {
  content: ""; display: inline-block; width: 5px; height: 5px; margin-right: 7px;
  border-radius: 50%; background: rgba(200,208,224,.55); vertical-align: 2px;
}

.ev-loop { will-change: transform; }
.ev-bob { animation: ev-bob 3.2s ease-in-out infinite alternate; }
.ev-rock { animation: ev-rock 4.4s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-sway { animation: ev-sway 2.6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 0%; }
.ev-wave { animation: ev-wave .45s ease-in-out 5 alternate; transform-box: fill-box; transform-origin: 50% 0%; }
.ev-hue { animation: ev-hue 5s linear infinite; }
.ev-flash { animation: ev-flash .7s ease-out 2; }
.ev-blink { animation: ev-blink 1.6s steps(1) infinite; }
.ev-glow { animation: ev-glow 1.4s ease-in-out infinite alternate; }
.ev-eyeblink { animation: ev-eyeblink 4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-hop { animation: ev-hop 1.05s cubic-bezier(.45,0,.55,1) infinite; transform-origin: 50% 100%; }
.ev-bighop { animation: ev-bighop .9s cubic-bezier(.3,0,.4,1) both; transform-origin: 50% 100%; }
.ev-spin { animation: ev-spin .6s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-puff { animation: ev-puff .9s ease-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-jump { animation: ev-jump .6s cubic-bezier(.3,0,.4,1) both; }
.ev-float { animation: ev-float 6s ease-in-out infinite alternate; transform-origin: 50% 50%; }
.ev-armwave { animation: ev-armwave .5s ease-in-out 4 alternate; transform-box: view-box; transform-origin: 102px 84px; }
.ev-tumble { animation: ev-tumble 16s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-squash { animation: ev-squash 7s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-twinkle { animation: ev-twinkle 1.8s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 50%; }
.ev-trail { animation: ev-trail 2.2s ease-out infinite; }
.ev-streak { animation: ev-streak var(--sd) cubic-bezier(.2,.6,.4,1) var(--delay) both; }
.ev-streak-still { animation: ev-streak-still 1.6s ease var(--delay) both; }
.ev-moon { animation: ev-moon var(--dur) ease both; }
.ev-iss { animation: ev-iss 6s linear .8s both; }

@keyframes ev-cross {
  from { transform: translate(var(--x0), 0); }
  to { transform: translate(var(--x1), var(--dy)); }
}
@keyframes ev-fade { 0% { opacity: 0; } 10% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ev-label { 0% { opacity: 0; transform: translateY(-3px); } 12% { opacity: 1; transform: none; } 82% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ev-pop { from { opacity: 0; transform: translateY(4px) scale(.7); } to { opacity: 1; transform: none; } }
@keyframes ev-sigh { 0%, 8% { opacity: 0; transform: translateY(4px) scale(.8); } 14%, 46% { opacity: 1; transform: none; } 56%, 100% { opacity: 0; transform: translateY(-6px); } }
@keyframes ev-bob { from { transform: translateY(0); } to { transform: translateY(-7px); } }
@keyframes ev-rock { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
@keyframes ev-sway { from { transform: rotate(-9deg); } to { transform: rotate(9deg); } }
@keyframes ev-wave { from { transform: rotate(-20deg); } to { transform: rotate(-150deg); } }
@keyframes ev-hue { from { filter: hue-rotate(0deg) saturate(1.2); } to { filter: hue-rotate(360deg) saturate(1.2); } }
@keyframes ev-flash { 0% { filter: brightness(1.9) drop-shadow(0 0 14px #fff); } 100% { filter: none; } }
@keyframes ev-blink { 0% { opacity: 1; } 50% { opacity: .15; } }
@keyframes ev-glow { from { opacity: .45; } to { opacity: 1; } }
@keyframes ev-eyeblink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
@keyframes ev-hop {
  0% { transform: translateY(0) scale(1.14, .84); }
  14% { transform: translateY(-8px) scale(.92, 1.1); }
  50% { transform: translateY(-46px) scale(1, 1); }
  86% { transform: translateY(-8px) scale(.95, 1.06); }
  100% { transform: translateY(0) scale(1.14, .84); }
}
@keyframes ev-bighop {
  0% { transform: translateY(0) scale(1.2, .8); }
  45% { transform: translateY(-80px) rotate(180deg); }
  90% { transform: translateY(0) rotate(360deg) scale(1.1, .9); }
  100% { transform: translateY(0) rotate(360deg); }
}
@keyframes ev-spin { to { transform: rotate(360deg); } }
@keyframes ev-puff { from { opacity: .9; transform: translateX(0) scale(.4); } to { opacity: 0; transform: translateX(-30px) scale(1.5); } }
@keyframes ev-jump { 0% { transform: none; } 40% { transform: translateY(-22px) rotate(-12deg); } 100% { transform: none; } }
@keyframes ev-float { from { transform: translateY(-6px) rotate(-5deg); } to { transform: translateY(8px) rotate(4deg); } }
@keyframes ev-armwave { from { transform: rotate(0deg); } to { transform: rotate(-70deg); } }
@keyframes ev-tumble { to { transform: rotate(360deg); } }
@keyframes ev-squash { from { transform: scale(1, 1); } to { transform: scale(.55, 1.08); } }
@keyframes ev-twinkle { from { transform: scale(.92); opacity: .85; } to { transform: scale(1.08); opacity: 1; } }
@keyframes ev-trail { from { opacity: .8; transform: translate(0, 0) scale(1); } to { opacity: 0; transform: translate(-26px, -14px) scale(.3); } }
@keyframes ev-streak {
  0% { opacity: 0; transform: translateX(var(--d0)) scaleX(.3); margin-top: 0; }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translateX(var(--d1)) scaleX(1); margin-top: .01px; }
}
@keyframes ev-streak-still { 0% { opacity: 0; } 30% { opacity: .8; } 100% { opacity: 0; } }
@keyframes ev-moon { 0% { opacity: 0; } 14% { opacity: .95; } 84% { opacity: .95; } 100% { opacity: 0; } }
/* 유성·정거장 키프레임의 margin-top은 눈에 띄지 않는 값이다. 합성 스레드 대신 메인 스레드에서 그리게 해서
   ?at= 로 시계를 돌린 장면이 헤드리스 스크린숏에도 그대로 찍히게 한다. */
@keyframes ev-iss { from { transform: translate(-820px, 60px); margin-top: 0; } to { transform: translate(820px, -60px); margin-top: .01px; } }

@media (prefers-reduced-motion: reduce) {
  .ev-loop, .ev-bob, .ev-rock, .ev-sway, .ev-hue, .ev-hop, .ev-spin, .ev-puff, .ev-float,
  .ev-tumble, .ev-squash, .ev-twinkle, .ev-trail, .ev-blink, .ev-eyeblink, .ev-sigh {
    animation: none !important;
  }
  .ev-wave, .ev-armwave, .ev-bighop, .ev-jump { animation-iteration-count: 1 !important; animation-duration: .3s !important; }
}
`;
