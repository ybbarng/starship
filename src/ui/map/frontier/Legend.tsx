"use client";

// 개척지 지도 도움말: 땅·표지·조작이 무엇을 뜻하는지(2026-11-02 사용자 요청 "화면이 뭘 의미하는지 잘 모르겠다").
// 그림은 지도가 쓰는 조각(FrontierView의 GROUND·CellDecor·깃발 등)을 그대로 작게 그린다. 설계: docs/frontier.md "도움말".
import type { RegionStatus } from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  Antenna,
  CellDecor,
  Crack,
  GROUND,
  Lander,
  MyFlag,
  NoEntry,
  OtherFlag,
  Rig,
  TERRITORY_COLORS,
} from "./FrontierView";
import { corners } from "./hex";

const T = 44;
const S = 16;
/** 화면에 보이는 그림 크기(좌표는 T로 그리고 줄여 보인다) */
const D = 34;
const C = { x: T / 2, y: T / 2 + 2 };
const UID = "legend";
const poly = (s = S) =>
  corners(C.x, C.y, s)
    .map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`)
    .join(" ");

/** 지도와 같은 무늬 정의(공사 흙·안개 먼지) */
function Defs() {
  return (
    <defs>
      <pattern
        id={`soil${UID}`}
        width="4.5"
        height="4.5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(28)"
      >
        <rect width="4.5" height="1.2" fill="#3a2414" />
      </pattern>
      <pattern
        id={`dust${UID}`}
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="1.5" cy="1.5" r="0.9" fill="#d8dce8" opacity="0.35" />
        <circle cx="5" cy="4.6" r="0.7" fill="#d8dce8" opacity="0.25" />
      </pattern>
    </defs>
  );
}

function Tile({
  st,
  children,
}: {
  st: RegionStatus | "plain";
  children?: React.ReactNode;
}) {
  return (
    <svg
      width={D}
      height={D}
      viewBox={`0 0 ${T} ${T}`}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <Defs />
      <polygon
        points={poly()}
        fill={st === "plain" ? "#3a2c2a" : GROUND[st]}
        opacity={st === "dropped" ? 0.6 : 1}
      />
      {st !== "plain" && <CellDecor st={st} p={C} s={S} ds={S} uid={UID} />}
      {children}
    </svg>
  );
}

const LANDS: { st: RegionStatus; name: string; say: string }[] = [
  { st: "fog", name: "안개", say: "아직 손대지 않은 일. 윤곽만 알아요" },
  { st: "building", name: "공사중", say: "지금 하고 있는 일(굴착기)" },
  { st: "done", name: "완공", say: "끝난 일(불 켜진 돔)" },
  { st: "blocked", name: "막힘", say: "무언가에 막혀 멈춘 일(붉은 울타리)" },
  { st: "dropped", name: "버림", say: "하지 않기로 한 일. 기본은 숨겨요" },
];

function Row({
  pic,
  name,
  say,
}: {
  pic: React.ReactNode;
  name: string;
  say: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      {pic}
      <div className="min-w-0 leading-snug">
        <div className="font-semibold text-white/90">{name}</div>
        <div className="text-[11.5px] text-white/55">{say}</div>
      </div>
    </li>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-3 mb-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/35 first:mt-0">
      {children}
    </h4>
  );
}

export function FrontierLegend({
  crew,
  onClose,
}: {
  crew?: Crew;
  onClose: () => void;
}) {
  return (
    <div
      data-map-legend
      data-camera="legend"
      role="dialog"
      aria-label="지도 도움말"
      className="absolute top-2 left-2 z-20 flex max-h-[calc(100%-1rem)] w-[540px] max-w-[calc(100%-1rem)] flex-col rounded-lg border border-white/15 bg-[#0a0a10]/95 text-[12.5px] shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="font-semibold text-white">이 지도 읽는 법</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="도움말 닫기"
          className="ml-auto rounded px-1.5 text-white/55 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-3 py-2.5 [scrollbar-width:thin]">
        <p className="text-white/70">
          프로젝트 하나가 <b className="text-white">행성 하나</b>예요. 가운데
          착륙선에서 일이 땅처럼 퍼져 나가요. 땅을 누르면 오른쪽 판에 자세한
          내용이 떠요.
        </p>

        {/* 두 단: 왼쪽 모양·땅 상태, 오른쪽 표지·다니기 */}
        <div className="mt-2.5 grid grid-cols-2 gap-x-5">
          <div>
            <H>모양</H>
            <ul className="space-y-1.5">
              <Row
                pic={
                  <svg
                    width={D}
                    height={D}
                    viewBox={`0 0 ${T} ${T}`}
                    aria-hidden
                    className="shrink-0"
                  >
                    <Lander x={C.x} y={C.y - 2} s={14} />
                  </svg>
                }
                name="착륙선"
                say="프로젝트의 목표. 왼쪽 아래 구석에 목표 글이 있어요"
              />
              <Row
                pic={
                  <svg
                    width={D}
                    height={D}
                    viewBox={`0 0 ${T} ${T}`}
                    aria-hidden
                    className="shrink-0"
                  >
                    <polygon
                      points={poly()}
                      fill="#3a2c2a"
                      stroke={TERRITORY_COLORS[0]}
                      strokeWidth="2.6"
                    />
                  </svg>
                }
                name="지역(색 굵은 테두리)"
                say="큰 갈래. 이름표의 '완공 2/9'는 끝난 칸 / 전체 칸"
              />
              <Row
                pic={<Tile st="building" />}
                name="땅 덩어리 · 칸"
                say="일 하나가 땅 한 덩어리. 칸이 많을수록 큰 일"
              />
              <Row
                pic={
                  <Tile st="fog">
                    <polygon
                      points={poly(S * 0.7)}
                      fill="none"
                      stroke="#7ce0ff"
                      strokeWidth="1.3"
                      strokeDasharray="3 2.5"
                    />
                  </Tile>
                }
                name="하늘색 점선"
                say="일하다 새로 찾은 땅(7일 안). 처음 계획 바깥에 붙어요"
              />
            </ul>

            <H>땅 모습 = 일의 상태</H>
            <ul className="space-y-1.5">
              {LANDS.map((l) => (
                <Row
                  key={l.st}
                  pic={
                    <Tile st={l.st}>
                      {l.st === "building" && <Rig x={C.x} y={C.y} s={S} />}
                      {l.st === "blocked" && (
                        <>
                          <polygon
                            points={poly(S * 0.8)}
                            fill="none"
                            stroke="#ff6b6b"
                            strokeWidth="2"
                            strokeDasharray="3.5 2"
                          />
                          <NoEntry x={C.x} y={C.y} s={S} />
                        </>
                      )}
                    </Tile>
                  }
                  name={l.name}
                  say={l.say}
                />
              ))}
            </ul>
          </div>
          <div>
            <H>표지</H>
            <ul className="space-y-1.5">
              <Row
                pic={
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center">
                    {crew ? (
                      <Animal
                        kind={animalFor(crew.id)}
                        pose={
                          crew.status === "off" ? "stand" : poseFor(crew.status)
                        }
                        context={crew.context}
                        size={28}
                        furniture={false}
                      />
                    ) : (
                      <span className="text-[22px]">📍</span>
                    )}
                  </div>
                }
                name="승무원"
                say="지금 일하는 땅. 일터가 바뀌면 걸어가고, 땅이 완공되면 폭죽이 터져요"
              />
              <Row
                pic={
                  <svg
                    width={D}
                    height={D}
                    viewBox={`0 0 ${T} ${T}`}
                    aria-hidden
                    className="shrink-0"
                  >
                    <rect
                      x="7"
                      y="13"
                      width="30"
                      height="18"
                      rx="9"
                      fill="#ffd84a"
                      stroke="#7a5a00"
                    />
                    <text
                      x="22"
                      y="26"
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="800"
                      fill="#1a1405"
                    >
                      ! 3
                    </text>
                  </svg>
                }
                name="말풍선"
                say="나를 기다리는 것 수. 옆판 '할 일'에 있어요"
              />
              <Row
                pic={
                  <Tile st="plain">
                    <MyFlag x={C.x - 4} y={C.y + 8} s={14} title="예시" />
                  </Tile>
                }
                name="큰 노란 깃발"
                say="내가 정해야 할 갈림길. ⑂ 다음 단추로 차례로 가요"
              />
              <Row
                pic={
                  <Tile st="plain">
                    <OtherFlag x={C.x - 3} y={C.y + 6} s={16} />
                  </Tile>
                }
                name="작은 회색 깃발"
                say="다른 사람이 정할 갈림길"
              />
              <Row
                pic={
                  <Tile st="plain">
                    <Antenna x={C.x} y={C.y + 6} s={16} waiting />
                  </Tile>
                }
                name="안테나"
                say="누군가와 주고받는 중인 교신. 전파가 움직이면 답을 기다리는 중"
              />
              <Row
                pic={
                  <Tile st="plain">
                    <Crack x={C.x} y={C.y} s={16} />
                  </Tile>
                }
                name="균열"
                say="알려진 위험. 완공 땅에서는 집 밑에 깔린 금(알고 두기로 한 문제). 땅을 누르면 내용이 보여요"
              />
            </ul>

            <H>다니기</H>
            <ul className="space-y-1 text-[11.5px] text-white/60">
              <li>
                끌어서 옮기고, 휠·두 손가락으로 확대해요. 빈 곳 두 번 누르면 그
                자리로 확대
              </li>
              <li>
                확대할수록 이름이 더 보여요. 숨은 이름은 마우스를 올리면 떠요
              </li>
              <li>
                키: <kbd>0</kbd> 전체 · <kbd>h</kbd> 지금 여기 · <kbd>f</kbd>{" "}
                다음 갈림길 · <kbd>Esc</kbd> 고르기 풀기
              </li>
              <li>아래 줄: 내가 정할 것 · 교신 · 막힘 수</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
