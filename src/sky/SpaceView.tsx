"use client";

// 창밖 우주. 실제 별 배치·별자리 선 위에서 오늘 날짜 위치의 태양계를 여행한다.
// 목적지는 useVoyage().travelTo(id)로 바꾼다.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import * as THREE from "three";
import {
  bvToRgb,
  compress,
  directionToCoords,
  earthBasis,
  equatorialToEcliptic,
  galacticToEquatorial,
  HALLEY,
  halleyPath,
  orbitPath,
  raDecToEcliptic,
  scaleMode,
  sceneDistance,
  toThree,
  type Vec3,
} from "./astro";
import {
  BODIES,
  BODY_BY_ID,
  type BodyDef,
  bodyPosition,
  DESTINATION_BY_ID,
  DESTINATIONS,
  type Destination,
  halleyPosition,
  PROBE_SIZE,
  PROBES,
  probePosition,
} from "./bodies";
import { loadCatalog, type SkyCatalog } from "./catalog";
import { projector } from "./projector";
import { ScaleNote } from "./ScaleNote";
import { useScale } from "./scale";
import * as S from "./shaders";
import {
  distanceKm,
  REAL_RADIUS_KM,
  realPositionAU,
  telemetry,
} from "./telemetry";
import { useVoyage } from "./voyage";

const SKY_RADIUS = 9000;
/** 유명한 별을 두는 거리. 실제 축척에서는 보이저보다 훨씬 바깥(그래도 실제보다는 가깝다). */
const starDistance = () => (scaleMode() === "real" ? 4e6 : 6000);
/** 이름표를 보여 주는 거리 배율(실제 축척은 줄인 축척보다 수십~수백 배 넓다) */
const rangeScale = () => (scaleMode() === "real" ? 600 : 1);
/** 위성 이름표를 보여 주는 거리(모행성 둘레만) */
const moonLabelRange = () => (scaleMode() === "real" ? 600 : 150);
const UP = new THREE.Vector3(0, 1, 0);
/**
 * 이보다 작게 보이는 천체는 원반 대신 빛점으로(픽셀 반지름).
 * 줄인 축척은 거리를 크게 줄여 먼 행성이 실제보다 크게 보이므로 기준을 높게 둔다.
 * 위성은 행성 사이보다 덜 줄였으므로 낮은 기준을 쓴다(지구에서 본 달은 원반으로 남는다).
 * 실제 축척에서는 겉보기 크기가 이미 실제와 같아, 1픽셀 남짓보다 작을 때만 빛점으로.
 */
const discMinPx = (isMoon: boolean) =>
  scaleMode() === "real" ? 1.5 : isMoon ? 4 : 14;
/** 행성 사진 텍스처 폴더. 기본은 저장소의 /textures, "off"면 모두 코드로 그린다. */
const DEFAULT_TEXTURES = "/textures";
const TEXTURES =
  process.env.NEXT_PUBLIC_PLANET_TEXTURES === "off"
    ? null
    : (process.env.NEXT_PUBLIC_PLANET_TEXTURES ?? DEFAULT_TEXTURES);

export type SpaceViewProps = {
  className?: string;
  /** 이름표 양 */
  labels?: "none" | "few" | "all";
  constellations?: boolean;
  /** 끌어서 둘러보기 */
  lookAround?: boolean;
  /** 천천히 도는 순항 */
  drift?: boolean;
  /** 별 크기 배율(작은 창에서는 줄인다) */
  starScale?: number;
  /** 천체나 이름표를 눌러 그곳으로 날아가기 */
  clickToFly?: boolean;
  /** 적도 좌표 격자(적경 2시간, 적위 15도마다) */
  grid?: boolean;
  /** 왼쪽 아래 축척 안내 */
  scaleNote?: boolean;
};

export function SpaceView({
  className,
  labels = "few",
  constellations = true,
  lookAround = false,
  drift = true,
  starScale = 1,
  clickToFly = true,
  grid = false,
  scaleNote = false,
}: SpaceViewProps) {
  const travelTo = useVoyage((s) => s.travelTo);
  const onPick = clickToFly ? travelTo : undefined;
  const [catalog, setCatalog] = useState<SkyCatalog | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const warpRef = useRef<HTMLCanvasElement>(null);
  const warp = useRef(0);
  const mode = useScale((s) => s.mode);

  useEffect(() => {
    let alive = true;
    loadCatalog().then((c) => alive && setCatalog(c));
    return () => {
      alive = false;
    };
  }, []);

  useWarpStreaks(warpRef, warp);

  return (
    // 배치는 className으로 받는다(예: "absolute inset-0"). 주지 않으면 relative.
    <div
      className={twMerge("relative overflow-hidden bg-[#02030a]", className)}
    >
      <Canvas
        linear
        flat
        dpr={[1, 2]}
        camera={{ fov: 55, near: 0.005, far: 30000, position: [0, 2, 20] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#02030a"]} />
        {catalog && (
          <>
            <SkyDome
              catalog={catalog}
              constellations={constellations}
              starScale={starScale}
              grid={grid}
            />
            {/* 축척이 바뀌면 크기·자리를 다시 계산하도록 통째로 다시 만든다. */}
            <group key={mode}>
              <SolarSystem catalog={catalog} onPick={onPick} />
              <StarTargets />
              <CameraRig lookAround={lookAround} drift={drift} warp={warp} />
              {labels !== "none" && (
                <LabelLayer
                  catalog={catalog}
                  container={labelRef}
                  amount={labels}
                  onPick={onPick}
                />
              )}
            </group>
          </>
        )}
      </Canvas>
      <div
        ref={labelRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <canvas
        ref={warpRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {scaleNote && (
        <ScaleNote className="absolute bottom-2 left-3 z-10 [&>span]:left-0 [&>span]:translate-x-0" />
      )}
    </div>
  );
}

// ── 하늘(별·은하수·별자리 선) ─────────────────────────────

function skyPoint(ra: number, dec: number, r = SKY_RADIUS): Vec3 {
  const [x, y, z] = toThree(raDecToEcliptic(ra, dec));
  return [x * r, y * r, z * r];
}

function SkyDome({
  catalog,
  constellations,
  starScale,
  grid,
}: {
  catalog: SkyCatalog;
  constellations: boolean;
  starScale: number;
  grid: boolean;
}) {
  const gridGeo = useMemo(() => equatorialGrid(), []);
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();

  const stars = useMemo(() => {
    const n = catalog.stars.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    catalog.stars.forEach(([ra, dec, mag, bv], i) => {
      pos.set(skyPoint(ra, dec), i * 3);
      const [r, g, b] = bvToRgb(bv);
      col.set([0.55 + 0.45 * r, 0.55 + 0.45 * g, 0.55 + 0.45 * b], i * 3);
      size[i] = Math.min(9, Math.max(1.2, 6.2 - mag * 0.85));
      seed[i] = (i * 0.618_034) % 1;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return geo;
  }, [catalog]);

  const milky = useMemo(() => milkyWayGeometry(), []);

  const lines = useMemo(() => {
    const pts: number[] = [];
    for (const c of catalog.constellations) {
      for (const line of c.lines) {
        for (let k = 0; k < line.length - 1; k++) {
          const a = line[k];
          const b = line[k + 1];
          if (!a || !b) continue;
          pts.push(
            ...skyPoint(a[0], a[1], SKY_RADIUS * 0.99),
            ...skyPoint(b[0], b[1], SKY_RADIUS * 0.99),
          );
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [catalog]);

  const starMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: S.starVertex,
        fragmentShader: S.starFragment,
        uniforms: {
          uPixelRatio: { value: gl.getPixelRatio() },
          uTime: { value: 0 },
          uScale: { value: starScale },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gl, starScale],
  );

  useFrame((state) => {
    group.current?.position.copy(camera.position);
    if (starMat.uniforms.uTime)
      starMat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={group} renderOrder={-10}>
      <points geometry={milky.dust} renderOrder={-12} frustumCulled={false}>
        <shaderMaterial
          args={[
            {
              vertexShader: S.starVertex,
              fragmentShader: S.softFragment,
              uniforms: {
                uPixelRatio: { value: gl.getPixelRatio() },
                uTime: { value: 0 },
                uScale: { value: 1 },
              },
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </points>
      <points
        geometry={stars}
        material={starMat}
        renderOrder={-11}
        frustumCulled={false}
      />
      {grid && (
        <lineSegments
          geometry={gridGeo}
          renderOrder={-11}
          frustumCulled={false}
        >
          <lineBasicMaterial
            color="#5fd4c4"
            transparent
            opacity={0.13}
            depthWrite={false}
          />
        </lineSegments>
      )}
      {constellations && (
        <lineSegments geometry={lines} renderOrder={-11} frustumCulled={false}>
          <lineBasicMaterial
            color="#6f8fd8"
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </lineSegments>
      )}
    </group>
  );
}

/** 은하수: 은하면을 따라 흐린 점을 뿌린다(외부 자료 없이 은하 좌표로 만든다). */
function milkyWayGeometry() {
  const rand = mulberry32(7);
  const n = 22_000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // 은하 중심 쪽에 더 많이
    let l = rand() * 360;
    if (rand() < 0.45) l = (gauss(rand) * 40 + 360) % 360;
    const center = Math.cos((l * Math.PI) / 180) * 0.5 + 0.5;
    const b = gauss(rand) * (3 + 5 * center);
    const big = rand() < 0.08;
    const [x, y, z] = galacticToEquatorial(l, b);
    const ecl = equatorialToEcliptic([x, y, z]);
    const [tx, ty, tz] = toThree(ecl);
    const r = SKY_RADIUS * 1.01;
    pos.set([tx * r, ty * r, tz * r], i * 3);
    const warm = center * 0.5 + rand() * 0.2;
    const a = (big ? 0.034 : 0.17) * (0.45 + center);
    col.set(
      [
        (0.6 + warm * 0.4) * a,
        (0.62 + warm * 0.25) * a,
        (0.8 - warm * 0.2) * a,
      ],
      i * 3,
    );
    size[i] = big ? 50 + rand() * 90 : 1.6 + rand() * 2;
    seed[i] = 0;
  }
  const dust = new THREE.BufferGeometry();
  dust.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  dust.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  dust.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  dust.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  return { dust };
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function gauss(rand: () => number) {
  return (
    Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())
  );
}

// ── 태양계 ───────────────────────────────────────────

const typeCode: Record<string, number> = {
  rocky: 1,
  earth: 2,
  gas: 3,
  ice: 4,
  volcanic: 5,
  cracked: 6,
};

function planetMaterial(body: BodyDef) {
  const s = body.surface;
  const c = (hex: string) => new THREE.Color(hex);
  let c1 = c("#888");
  let c2 = c("#aaa");
  let c3 = c("#555");
  let bands = 0;
  let storm = 0;
  let craters = 0;
  if (s.type === "earth") {
    c1 = c(s.ocean);
    c2 = c(s.land);
    c3 = c(s.ice);
  } else if (s.type !== "star") {
    [c1, c2, c3] = s.colors.map(c) as [THREE.Color, THREE.Color, THREE.Color];
    if (s.type === "gas") {
      bands = s.bands;
      storm = s.storm ? 1 : 0;
    }
    if (s.type === "rocky") craters = s.craters ? 1 : 0;
  }
  const mat = new THREE.ShaderMaterial({
    vertexShader: S.planetVertex,
    fragmentShader: S.planetFragment,
    uniforms: {
      uType: { value: typeCode[s.type] ?? 1 },
      uC1: { value: c1 },
      uC2: { value: c2 },
      uC3: { value: c3 },
      uAtmo: { value: c(body.atmosphere ?? "#000") },
      uHasAtmo: { value: body.atmosphere ? 1 : 0 },
      uBands: { value: bands },
      uStorm: { value: storm },
      uCraters: { value: craters },
      uSeed: { value: body.id.length * 3.7 },
      uTime: { value: 0 },
      uSunPos: { value: new THREE.Vector3() },
      uMap: { value: null },
      uHasMap: { value: 0 },
    },
  });
  mat.uniforms.uNight = { value: null };
  loadTexture(`${body.id}.jpg`, (tex) => {
    if (mat.uniforms.uMap && mat.uniforms.uHasMap) {
      mat.uniforms.uMap.value = tex;
      mat.uniforms.uHasMap.value = 1;
    }
  });
  if (body.id === "earth") {
    loadTexture("earth-night.jpg", (tex) => {
      if (mat.uniforms.uNight) mat.uniforms.uNight.value = tex;
    });
  }
  return mat;
}

/** public/textures에 있는 파일(docs/ASSETS.md). 없는 천체는 코드로 그린 표면을 쓴다. */
const TEXTURE_FILES = new Set([
  "sun.jpg",
  "mercury.jpg",
  "venus.jpg",
  "earth.jpg",
  "earth-night.jpg",
  "earth-clouds.jpg",
  "moon.jpg",
  "mars.jpg",
  "jupiter.jpg",
  "saturn.jpg",
  "saturn-ring.png",
  "uranus.jpg",
  "neptune.jpg",
]);

const loader = new THREE.TextureLoader();

function loadTexture(file: string, onLoad: (tex: THREE.Texture) => void) {
  if (!TEXTURES) return;
  // 기본 폴더(/textures)에는 정해진 파일만 있다. 다른 폴더를 주면 무엇이든 시도한다.
  if (TEXTURES === DEFAULT_TEXTURES && !TEXTURE_FILES.has(file)) return;
  loader.load(
    `${TEXTURES.replace(/\/$/, "")}/${file}`,
    (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 4;
      onLoad(tex);
    },
    undefined,
    () => {
      // 텍스처가 없으면 코드로 그린 표면을 그대로 쓴다.
    },
  );
}

function SolarSystem({
  catalog,
  onPick,
}: {
  catalog: SkyCatalog;
  onPick?: (id: string) => void;
}) {
  return (
    <group>
      <Sun />
      {BODIES.filter((b) => b.id !== "sun").map((b) => (
        <Planet key={b.id} body={b} catalog={catalog} onPick={onPick} />
      ))}
      <AsteroidBelt />
      <Orbits catalog={catalog} />
      <Comet />
      {/* 탐사선(일반 재질)만 받는 빛. 행성은 셰이더가 직접 태양 쪽을 칠한다. */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={2.4} decay={0} />
      {PROBES.map((p) => (
        <ProbeModel key={p.id} id={p.id} onPick={onPick} />
      ))}
      <BodyDots catalog={catalog} />
    </group>
  );
}

/**
 * 실제 비율로 그리면 먼 행성은 한 점보다 작아진다. 밤하늘의 행성처럼 작은 빛점을 남겨
 * "저기 있다"는 것만 보이게 한다. 가까우면 천체 자체가 이 점을 가린다.
 */
function BodyDots({ catalog }: { catalog: SkyCatalog }) {
  const { gl } = useThree();
  const list = useMemo(
    () => [
      ...BODIES.filter((b) => b.id !== "sun").map((b) => ({
        at: (ms: number) => bodyPosition(b, catalog.orbits, ms),
        color: dotColor(b),
        size: b.parent ? 1.6 : 2.4,
      })),
      ...PROBES.map((p) => ({
        at: (ms: number) => probePosition(p.id, ms),
        color: [0.85, 0.92, 1] as Vec3,
        size: 2,
      })),
    ],
    [catalog],
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = list.length;
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    g.setAttribute(
      "aColor",
      new THREE.BufferAttribute(
        new Float32Array(list.flatMap((d) => d.color)),
        3,
      ),
    );
    g.setAttribute(
      "aSize",
      new THREE.BufferAttribute(new Float32Array(list.map((d) => d.size)), 1),
    );
    g.setAttribute(
      "aSeed",
      new THREE.BufferAttribute(new Float32Array(n).fill(0.5), 1),
    );
    return g;
  }, [list]);
  useFrame(() => {
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const now = Date.now();
    list.forEach((d, i) => {
      pos.setXYZ(i, ...d.at(now));
    });
    pos.needsUpdate = true;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        args={[
          {
            vertexShader: S.starVertex,
            fragmentShader: S.starFragment,
            uniforms: {
              uPixelRatio: { value: gl.getPixelRatio() },
              uTime: { value: 0 },
              uScale: { value: 1 },
            },
            transparent: true,
            depthWrite: false,
          },
        ]}
      />
    </points>
  );
}

function dotColor(b: BodyDef): Vec3 {
  const s = b.surface;
  const hex =
    s.type === "star" ? s.color : s.type === "earth" ? "#9cc4ff" : s.colors[1];
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/**
 * 보이저를 닮은 단순한 그림: 지구를 향한 큰 접시 안테나, 십각형 몸통,
 * 긴 자력계 막대, 원자력 전지(RTG) 막대, 과학 장비 막대. 실제 크기로는 보이지 않아 크게 그렸다.
 */
function ProbeModel({
  id,
  onPick,
}: {
  id: string;
  onPick?: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const s = PROBE_SIZE;
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const home = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const [x, y, z] = probePosition(id, Date.now());
    g.position.set(x, y, z);
    // 접시는 늘 지구(거의 태양 쪽)를 본다.
    home.set(-x, -y, -z).normalize();
    g.quaternion.setFromUnitVectors(yAxis, home);
  });
  const metal = "#c9ccd2";
  const dark = "#4a4f58";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: three.js 그룹이라 HTML 접근성 규칙이 맞지 않는다(이름표 버튼이 같은 일을 한다)
    <group
      ref={group}
      onClick={
        onPick
          ? (e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              onPick(id);
            }
          : undefined
      }
    >
      {/* 접시 안테나: 얕은 원뿔 + 앞면 원판 */}
      <mesh position={[0, s * 0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[s, s * 0.3, 40, 1, true]} />
        <meshLambertMaterial color="#f2f2ee" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, s * 0.6, 0]}>
        <cylinderGeometry args={[s * 0.035, s * 0.06, s * 0.4, 8]} />
        <meshLambertMaterial color={metal} />
      </mesh>
      {/* 십각형 몸통 */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[s * 0.32, s * 0.32, s * 0.16, 10]} />
        <meshLambertMaterial color={dark} />
      </mesh>
      {/* 자력계 막대(길게) */}
      <mesh position={[-s * 2.1, -s * 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[s * 0.012, s * 0.012, s * 3.8, 6]} />
        <meshLambertMaterial color={metal} />
      </mesh>
      {/* RTG 막대와 전지 세 통 */}
      <group position={[s * 0.32, -s * 0.08, s * 0.3]} rotation={[0, -0.6, 0]}>
        <mesh position={[s * 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[s * 0.015, s * 0.015, s, 6]} />
          <meshLambertMaterial color={metal} />
        </mesh>
        {[0.55, 0.75, 0.95].map((k) => (
          <mesh key={k} position={[s * k, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[s * 0.07, s * 0.07, s * 0.16, 12]} />
            <meshLambertMaterial color="#6e6a63" />
          </mesh>
        ))}
      </group>
      {/* 과학 장비 막대와 끝의 관측대 */}
      <group position={[s * 0.3, -s * 0.06, -s * 0.3]} rotation={[0, 0.7, 0]}>
        <mesh position={[s * 0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[s * 0.015, s * 0.015, s * 1.1, 6]} />
          <meshLambertMaterial color={metal} />
        </mesh>
        <mesh position={[s * 1.1, s * 0.05, 0]}>
          <boxGeometry args={[s * 0.18, s * 0.22, s * 0.16]} />
          <meshLambertMaterial color="#8a8f99" />
        </mesh>
      </group>
    </group>
  );
}

function Sun() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: S.planetVertex,
        fragmentShader: S.sunFragment,
        uniforms: {
          uTime: { value: 0 },
          uTint: { value: new THREE.Color(1, 1, 1) },
          uIsStar: { value: 0 },
          uMap: { value: null },
          uHasMap: { value: 0 },
        },
      }),
    [],
  );
  useEffect(() => {
    loadTexture("sun.jpg", (tex) => {
      if (mat.uniforms.uMap && mat.uniforms.uHasMap) {
        mat.uniforms.uMap.value = tex;
        mat.uniforms.uHasMap.value = 1;
      }
    });
  }, [mat]);
  const glow = useRef<THREE.Mesh>(null);
  const far = useRef<THREE.Points>(null);
  const { camera } = useThree();
  const sun = BODY_BY_ID.get("sun") as BodyDef;
  const farGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    g.setAttribute(
      "aColor",
      new THREE.Float32BufferAttribute([1, 0.9, 0.7], 3),
    );
    g.setAttribute("aSize", new THREE.Float32BufferAttribute([5], 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute([0.3], 1));
    return g;
  }, []);
  useFrame((state) => {
    if (mat.uniforms.uTime) mat.uniforms.uTime.value = state.clock.elapsedTime;
    glow.current?.quaternion.copy(camera.quaternion);
    if (far.current)
      far.current.visible =
        camera.position.length() > (scaleMode() === "real" ? 30_000 : 3000);
  });
  return (
    <group>
      <mesh material={mat}>
        <sphereGeometry args={[sun.radius, 64, 48]} />
      </mesh>
      <mesh ref={glow} renderOrder={2}>
        <planeGeometry args={[sun.radius * 9, sun.radius * 9]} />
        <shaderMaterial
          args={[
            {
              vertexShader: S.glowVertex,
              fragmentShader: S.glowFragment,
              uniforms: {
                uColor: { value: new THREE.Color("#ffb347") },
                uIntensity: { value: 1 },
              },
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </mesh>
      <points ref={far} geometry={farGeo} frustumCulled={false}>
        <shaderMaterial
          args={[
            {
              vertexShader: S.starVertex,
              fragmentShader: S.starFragment,
              uniforms: {
                uPixelRatio: { value: 1 },
                uTime: { value: 0 },
                uScale: { value: 1.4 },
              },
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </points>
    </group>
  );
}

function Planet({
  body,
  catalog,
  onPick,
}: {
  body: BodyDef;
  catalog: SkyCatalog;
  onPick?: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => planetMaterial(body), [body]);
  const ringMat = useMemo(
    () =>
      body.ring
        ? new THREE.ShaderMaterial({
            vertexShader: S.ringVertex,
            fragmentShader: S.ringFragment,
            uniforms: {
              uColor: { value: new THREE.Color(body.ring.color) },
              uInner: { value: body.ring.inner * body.radius },
              uOuter: { value: body.ring.outer * body.radius },
              uSunPos: { value: new THREE.Vector3() },
              uPlanetPos: { value: new THREE.Vector3() },
              uPlanetRadius: { value: body.radius },
              uMap: { value: null },
              uHasMap: { value: 0 },
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : null,
    [body],
  );
  const tilt = ((body.tilt ?? 0) * Math.PI) / 180;
  const segments = body.radius > 0.5 ? 96 : 48;
  const isEarth = body.id === "earth";
  const isMoon = body.id === "moon";
  const clouds = useRef<THREE.Mesh>(null);
  const cloudMat = useMemo(
    () =>
      isEarth
        ? new THREE.ShaderMaterial({
            vertexShader: S.planetVertex,
            fragmentShader: S.cloudFragment,
            uniforms: {
              uMap: { value: null },
              uSunPos: { value: new THREE.Vector3() },
            },
            transparent: true,
            depthWrite: false,
          })
        : null,
    [isEarth],
  );
  useEffect(() => {
    if (cloudMat)
      loadTexture("earth-clouds.jpg", (tex) => {
        if (cloudMat.uniforms.uMap) cloudMat.uniforms.uMap.value = tex;
        if (clouds.current) clouds.current.visible = true;
      });
    if (ringMat)
      loadTexture(`${body.id}-ring.png`, (tex) => {
        if (ringMat.uniforms.uMap && ringMat.uniforms.uHasMap) {
          ringMat.uniforms.uMap.value = tex;
          ringMat.uniforms.uHasMap.value = 1;
        }
      });
  }, [cloudMat, ringMat, body.id]);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const vx = useMemo(() => new THREE.Vector3(), []);
  const vy = useMemo(() => new THREE.Vector3(), []);
  const vz = useMemo(() => new THREE.Vector3(), []);
  const earthBody = BODY_BY_ID.get("earth") as BodyDef;
  const pickable = Boolean(onPick && DESTINATION_BY_ID.has(body.id));

  const { camera, gl } = useThree();
  // 본체 반지름으로 판단한다(고리는 맨눈으로 보이지 않는다).
  const reach = body.radius;
  useFrame((state, dt) => {
    const now = Date.now();
    const [x, y, z] = bodyPosition(body, catalog.orbits, now);
    const g = group.current;
    if (g) {
      g.position.set(x, y, z);
      // 맨눈으로 먼 행성은 원반이 아니라 빛점이다. 화면에서 몇 픽셀보다 작아지면 원반을 끄고
      // BodyDots의 빛점만 남긴다(공기가 없어 흐려지지는 않지만, 원반 모양과 고리는 보이지 않는다).
      const cam = camera as THREE.PerspectiveCamera;
      const focal =
        gl.domElement.clientHeight / 2 / Math.tan((cam.fov * Math.PI) / 360);
      const px = (reach / cam.position.distanceTo(g.position)) * focal;
      g.visible = px > discMinPx(Boolean(body.parent));
    }
    const m = spin.current;
    if (m && isEarth) {
      // 지금 이 순간의 실제 자전 각도: 그리니치가 가리키는 방향에 텍스처 경도 0을 맞춘다.
      const { greenwich: g, north: n, east: e } = earthBasis(now);
      basis.makeBasis(vx.set(...g), vy.set(...n), vz.set(-e[0], -e[1], -e[2]));
      m.quaternion.setFromRotationMatrix(basis);
      if (clouds.current) {
        clouds.current.quaternion.copy(m.quaternion);
        clouds.current.rotateY(state.clock.elapsedTime * 0.004);
      }
    } else if (m && isMoon) {
      // 달은 늘 같은 면(텍스처 경도 0)이 지구를 본다.
      const [ex, ey, ez] = bodyPosition(earthBody, catalog.orbits, now);
      vx.set(ex - x, ey - y, ez - z).normalize();
      vz.crossVectors(vx, UP).normalize();
      vy.crossVectors(vz, vx);
      basis.makeBasis(vx, vy, vz);
      m.quaternion.setFromRotationMatrix(basis);
    } else if (m) {
      m.rotation.y += dt * 0.03;
    }
    if (mat.uniforms.uTime) mat.uniforms.uTime.value = state.clock.elapsedTime;
    if (ringMat?.uniforms.uPlanetPos)
      ringMat.uniforms.uPlanetPos.value.set(x, y, z);
  });

  return (
    <group ref={group}>
      <group rotation={[0, 0, isEarth || isMoon ? 0 : tilt]}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: three.js 메시라 HTML 접근성 규칙이 맞지 않는다(이름표 버튼이 같은 일을 한다) */}
        <mesh
          ref={spin}
          material={mat}
          onClick={
            pickable
              ? (e) => {
                  // 끌어서 둘러본 것이면 날아가지 않는다.
                  if (e.delta > 5) return;
                  e.stopPropagation();
                  onPick?.(body.id);
                }
              : undefined
          }
          onPointerOver={
            pickable
              ? (e) => {
                  e.stopPropagation();
                  document.body.style.cursor = "pointer";
                }
              : undefined
          }
          onPointerOut={
            pickable ? () => (document.body.style.cursor = "") : undefined
          }
        >
          <sphereGeometry args={[body.radius, segments, segments / 2]} />
        </mesh>
        {cloudMat && (
          <mesh
            ref={clouds}
            material={cloudMat}
            visible={false}
            raycast={() => null}
          >
            <sphereGeometry
              args={[body.radius * 1.012, segments, segments / 2]}
            />
          </mesh>
        )}
        {ringMat && body.ring && (
          <mesh material={ringMat} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[
                body.ring.inner * body.radius,
                body.ring.outer * body.radius,
                128,
                1,
              ]}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

function AsteroidBelt() {
  const geo = useMemo(() => {
    const rand = mulberry32(11);
    const n = 2400;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = 2.15 + rand() * 1.15;
      const th = rand() * Math.PI * 2;
      const inc = gauss(rand) * 0.08;
      const [x, y, z] = toThree(
        compress([a * Math.cos(th), a * Math.sin(th), a * inc]),
      );
      pos.set([x, y, z], i * 3);
      const g = 0.35 + rand() * 0.25;
      col.set([g, g * 0.95, g * 0.88], i * 3);
      size[i] = 1 + rand() * 1.4;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);
  const { gl } = useThree();
  return (
    <points geometry={geo}>
      <shaderMaterial
        args={[
          {
            vertexShader: S.starVertex,
            fragmentShader: S.starFragment,
            uniforms: {
              uPixelRatio: { value: gl.getPixelRatio() },
              uTime: { value: 0 },
              uScale: { value: 0.8 },
            },
            transparent: true,
            depthWrite: false,
          },
        ]}
      />
    </points>
  );
}

function Orbits({ catalog }: { catalog: SkyCatalog }) {
  const destId = useVoyage((s) => s.destinationId);
  const view = DESTINATION_BY_ID.get(destId)?.view;
  const geos = useMemo(() => {
    const now = Date.now();
    const list = BODIES.filter((b) => b.orbit).map((b) => {
      const el = catalog.orbits[b.orbit as string];
      const pts = el ? orbitPath(el, now).map((p) => toThree(compress(p))) : [];
      return new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(...p)),
      );
    });
    const halley = new THREE.BufferGeometry().setFromPoints(
      halleyPath().map((p) => new THREE.Vector3(...toThree(compress(p)))),
    );
    return { list, halley };
  }, [catalog]);
  // 궤도선은 위에서 내려다볼 때만 그린다(옆에서 보면 가로줄로 보여 거슬린다).
  if (!view) return null;
  const opacity = 0.32;
  return (
    <group>
      {geos.list.map((g) => (
        <lineLoop key={g.uuid} geometry={g}>
          <lineBasicMaterial
            color="#7da2ff"
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        </lineLoop>
      ))}
      <line>
        <primitive object={geos.halley} attach="geometry" />
        <lineBasicMaterial
          color="#9fe3ff"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </line>
    </group>
  );
}

/** 핼리 혜성(1986년 근일점 무렵 자리). 먼지 꼬리와 이온 꼬리. */
function Comet() {
  const pos = useMemo(
    () => halleyPosition(HALLEY.perihelion + 10 * 86_400_000),
    [],
  );
  const anti = useMemo(() => new THREE.Vector3(...pos).normalize(), [pos]);
  const side = useMemo(
    () => new THREE.Vector3().crossVectors(anti, UP).normalize(),
    [anti],
  );
  const { gl, camera } = useThree();
  const coma = useRef<THREE.Mesh>(null);
  const tails = useMemo(() => {
    const make = (n: number) => {
      const g = new THREE.BufferGeometry();
      const p = new Float32Array(n * 3);
      const t = new Float32Array(n);
      const s = new Float32Array(n);
      const rand = mulberry32(n);
      for (let i = 0; i < n; i++) {
        t[i] = rand();
        s[i] = rand();
      }
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
      g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
      return g;
    };
    return { dust: make(3200), ion: make(1600) };
  }, []);
  const mat = (color: string, curve: number, spread: number, length: number) =>
    new THREE.ShaderMaterial({
      vertexShader: S.tailVertex,
      fragmentShader: S.tailFragment,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uDir: { value: anti },
        uSide: { value: side },
        uLength: { value: length },
        uCurve: { value: curve },
        uSpread: { value: spread },
        uColor: { value: new THREE.Color(color) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 혜성 자리는 처음 한 번만 정한다
  const mats = useMemo(
    () => ({
      dust: mat("#ffe2b0", 0.35, 0.22, 7),
      ion: mat("#8fd4ff", 0.0, 0.05, 10),
    }),
    [anti],
  );
  useFrame((state) => {
    for (const m of [mats.dust, mats.ion])
      if (m.uniforms.uTime) m.uniforms.uTime.value = state.clock.elapsedTime;
    coma.current?.quaternion.copy(camera.quaternion);
  });
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.04, 16, 12]} />
        <meshBasicMaterial color="#cfc6b8" />
      </mesh>
      <mesh ref={coma}>
        <planeGeometry args={[1.4, 1.4]} />
        <shaderMaterial
          args={[
            {
              vertexShader: S.glowVertex,
              fragmentShader: S.glowFragment,
              uniforms: {
                uColor: { value: new THREE.Color("#bfe9ff") },
                uIntensity: { value: 0.9 },
              },
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </mesh>
      <points
        geometry={tails.dust}
        material={mats.dust}
        frustumCulled={false}
      />
      <points geometry={tails.ion} material={mats.ion} frustumCulled={false} />
    </group>
  );
}

// ── 유명한 별(목적지) ─────────────────────────────────

function starTargetPosition(d: Destination): THREE.Vector3 {
  const s = d.star;
  if (!s) return new THREE.Vector3();
  const [x, y, z] = toThree(raDecToEcliptic(s.ra, s.dec));
  return new THREE.Vector3(x, y, z).multiplyScalar(starDistance());
}

function starSurface(color: string) {
  return new THREE.ShaderMaterial({
    vertexShader: S.planetVertex,
    fragmentShader: S.sunFragment,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(color) },
      uIsStar: { value: 1 },
    },
  });
}

function StarTargets() {
  const { camera } = useThree();
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const stars = useMemo(() => DESTINATIONS.filter((d) => d.star), []);
  const surfaces = useMemo(
    () =>
      new Map(stars.map((d) => [d.id, starSurface(d.star?.color ?? "#fff")])),
    [stars],
  );
  useFrame(() => {
    for (const m of refs.current) m?.quaternion.copy(camera.quaternion);
  });
  return (
    <group>
      {stars.map((d, i) => {
        const s = d.star;
        if (!s) return null;
        const p = starTargetPosition(d);
        const perp = new THREE.Vector3()
          .crossVectors(p.clone().normalize(), UP)
          .normalize();
        const comp = s.companion
          ? p.clone().add(perp.multiplyScalar(s.companion.offset))
          : null;
        return (
          <group key={d.id}>
            <mesh position={p} material={surfaces.get(d.id)}>
              <sphereGeometry args={[s.radius, 64, 48]} />
            </mesh>
            <mesh
              position={p}
              ref={(m) => {
                refs.current[i * 2] = m;
              }}
            >
              <planeGeometry args={[s.radius * 10, s.radius * 10]} />
              <shaderMaterial
                args={[
                  {
                    vertexShader: S.glowVertex,
                    fragmentShader: S.glowFragment,
                    uniforms: {
                      uColor: { value: new THREE.Color(s.color) },
                      uIntensity: { value: 1 },
                    },
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                  },
                ]}
              />
            </mesh>
            {comp && s.companion && (
              <>
                <mesh position={comp}>
                  <sphereGeometry args={[s.companion.radius, 32, 24]} />
                  <meshBasicMaterial color={s.companion.color} />
                </mesh>
                <mesh
                  position={comp}
                  ref={(m) => {
                    refs.current[i * 2 + 1] = m;
                  }}
                >
                  <planeGeometry
                    args={[s.companion.radius * 10, s.companion.radius * 10]}
                  />
                  <shaderMaterial
                    args={[
                      {
                        vertexShader: S.glowVertex,
                        fragmentShader: S.glowFragment,
                        uniforms: {
                          uColor: { value: new THREE.Color(s.companion.color) },
                          uIntensity: { value: 0.9 },
                        },
                        transparent: true,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending,
                      },
                    ]}
                  />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ── 카메라: 목적지 자리 잡기와 이동 ─────────────────────────

type Pose = { center: THREE.Vector3; dir: THREE.Vector3; dist: number };

function poseFor(dest: Destination, orbits: SkyCatalog["orbits"] | null): Pose {
  const now = Date.now();
  if (dest.view === "overview") {
    return {
      center: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0.9, 0.44).normalize(),
      // 해왕성 궤도(태양에서 약 240)가 화면에 들어오게
      dist: sceneDistance(30) * 2.3,
    };
  }
  if (dest.view === "inner") {
    return {
      center: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0.88, 0.47).normalize(),
      // 소행성대 바깥(3.3 AU)까지
      dist: sceneDistance(3.3) * 2.2,
    };
  }
  if (dest.probe) {
    const center = new THREE.Vector3(...probePosition(dest.probe, now));
    // 햇빛 받는 옆쪽에서: 지구를 향한 접시 앞면이 보인다.
    const home = center.clone().normalize().negate();
    const side = new THREE.Vector3().crossVectors(home, UP).normalize();
    const dir = side
      .multiplyScalar(0.85)
      .add(home.multiplyScalar(0.35))
      .add(UP.clone().multiplyScalar(0.3))
      .normalize();
    return { center, dir, dist: PROBE_SIZE * 16 };
  }
  if (dest.star) {
    const center = starTargetPosition(dest);
    const back = center.clone().normalize().negate();
    const perp = new THREE.Vector3().crossVectors(back, UP).normalize();
    const dir = back
      .multiplyScalar(0.8)
      .add(perp.multiplyScalar(0.55))
      .add(UP.clone().multiplyScalar(0.12))
      .normalize();
    return { center, dir, dist: dest.star.radius * 12 };
  }
  if (dest.id === "halley") {
    const center = new THREE.Vector3(
      ...halleyPosition(HALLEY.perihelion + 10 * 86_400_000),
    );
    const anti = center.clone().normalize();
    const side = new THREE.Vector3().crossVectors(anti, UP).normalize();
    const dir = side
      .multiplyScalar(0.9)
      .add(UP.clone().multiplyScalar(0.25))
      .add(anti.multiplyScalar(-0.35))
      .normalize();
    return {
      center: center.add(
        new THREE.Vector3(
          ...center.clone().normalize().multiplyScalar(3).toArray(),
        ),
      ),
      dir,
      dist: 9,
    };
  }
  const body = dest.body ? BODY_BY_ID.get(dest.body) : undefined;
  if (!body || !orbits)
    return {
      center: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0.2, 1).normalize(),
      dist: 20,
    };
  if (body.id === "sun") {
    return {
      center: new THREE.Vector3(),
      dir: new THREE.Vector3(0.35, 0.22, 1).normalize(),
      dist: body.radius * 6,
    };
  }
  const center = new THREE.Vector3(...bodyPosition(body, orbits, now));
  const sunDir = center.clone().normalize().negate();
  const side = new THREE.Vector3().crossVectors(sunDir, UP).normalize();
  let dir: THREE.Vector3;
  if (body.parent) {
    const parent = BODY_BY_ID.get(body.parent.id) as BodyDef;
    const pPos = new THREE.Vector3(...bodyPosition(parent, orbits, now));
    const away = center.clone().sub(pPos).normalize();
    dir = away
      .multiplyScalar(0.85)
      .add(sunDir.multiplyScalar(0.45))
      .add(UP.clone().multiplyScalar(0.12))
      .normalize();
    return { center, dir, dist: body.radius * 12 };
  }
  dir = sunDir
    .multiplyScalar(0.55)
    .add(side.multiplyScalar(0.8))
    .add(UP.clone().multiplyScalar(0.2))
    .normalize();
  const reach = body.ring
    ? body.radius * body.ring.outer * 5.5
    : body.radius * 9;
  return { center, dir, dist: reach };
}

/**
 * 카메라가 그리는 거리 범위. 가까운 면은 목적지를 보는 거리에 맞추고(작은 위성 앞에서는 아주 가깝게),
 * 먼 면은 축척에 맞춘다. 실제 축척은 해왕성까지 35만 칸이 넘는다.
 */
function fitClipRange(camera: THREE.PerspectiveCamera, viewDist: number) {
  const near = Math.min(0.5, Math.max(0.0005, viewDist * 0.01));
  const far = scaleMode() === "real" ? 3e7 : 30_000;
  if (Math.abs(camera.near - near) > camera.near * 0.2 || camera.far !== far) {
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

function CameraRig({
  lookAround,
  drift,
  warp,
}: {
  lookAround: boolean;
  drift: boolean;
  warp: RefObject<number>;
}) {
  const { camera, gl } = useThree();
  const destinationId = useVoyage((s) => s.destinationId);
  const setPhase = useVoyage((s) => s._setPhase);
  const [orbits, setOrbits] = useState<SkyCatalog["orbits"] | null>(null);
  const trip = useRef<{
    from: THREE.Vector3;
    fromLook: THREE.Vector3;
    start: number;
    duration: number;
    far: boolean;
    /** 출발할 때의 실제 위치(AU) */
    fromReal: Vec3;
  } | null>(null);
  const look = useRef(new THREE.Vector3());
  const lastInteract = useRef(0);
  const lastReal = useRef<Vec3 | null>(null);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const first = useRef(true);
  const lastProgress = useRef(0);

  useEffect(() => {
    loadCatalog().then((c) => setOrbits(c.orbits));
  }, []);

  // 목적지가 바뀌면 지금 자리에서 출발한다.
  useEffect(() => {
    if (!orbits) return;
    const dest = DESTINATION_BY_ID.get(destinationId);
    if (!dest) return;
    if (first.current) {
      first.current = false;
      const p = poseFor(dest, orbits);
      camera.position.copy(
        p.center.clone().add(p.dir.clone().multiplyScalar(p.dist)),
      );
      look.current.copy(p.center);
      camera.lookAt(look.current);
      setPhase("cruise");
      return;
    }
    const p = poseFor(dest, orbits);
    const to = p.center.clone().add(p.dir.clone().multiplyScalar(p.dist));
    const d = camera.position.distanceTo(to);
    trip.current = {
      from: camera.position.clone(),
      fromLook: look.current.clone(),
      start: performance.now(),
      duration: Math.min(7, 2.4 + 1.1 * Math.log10(1 + d)) * 1000,
      far: d > (scaleMode() === "real" ? 200_000 : 3000),
      fromReal: [...telemetry.position] as Vec3,
    };
    yaw.current = 0;
    pitch.current = 0;
  }, [destinationId, orbits, camera, setPhase]);

  // 끌어서 둘러보기
  useEffect(() => {
    if (!lookAround) return;
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      lastInteract.current = performance.now();
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      yaw.current -= (e.clientX - down.x) * 0.005;
      pitch.current = Math.max(
        -1.2,
        Math.min(1.2, pitch.current + (e.clientY - down.y) * 0.004),
      );
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      down = null;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.style.cursor = "grab";
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
  }, [lookAround, gl]);

  useFrame((_, dt) => {
    projector.camera = camera as THREE.PerspectiveCamera;
    projector.width = gl.domElement.clientWidth;
    projector.height = gl.domElement.clientHeight;
    if (!orbits) return;
    const dest = DESTINATION_BY_ID.get(destinationId);
    if (!dest) return;
    const p = poseFor(dest, orbits);
    // 둘러본 뒤 몇 초는 저절로 돌지 않는다.
    if (
      drift &&
      !trip.current &&
      performance.now() - lastInteract.current > 5000
    )
      yaw.current += dt * 0.012;
    const dir = p.dir
      .clone()
      .applyAxisAngle(UP, yaw.current)
      .applyAxisAngle(
        new THREE.Vector3().crossVectors(p.dir, UP).normalize(),
        pitch.current,
      );
    const target = p.center.clone().add(dir.multiplyScalar(p.dist));

    const t0 = trip.current;
    if (t0) {
      const raw = Math.min(1, (performance.now() - t0.start) / t0.duration);
      const e = easeInOut(raw);
      const mid = t0.from.clone().lerp(target, 0.5);
      if (!t0.far)
        mid.add(UP.clone().multiplyScalar(t0.from.distanceTo(target) * 0.25));
      // 2차 베지어
      const a = t0.from.clone().lerp(mid, e);
      const b = mid.clone().lerp(target, e);
      camera.position.copy(a.lerp(b, e));
      look.current.copy(
        t0.fromLook.clone().lerp(p.center, easeInOut(Math.min(1, raw * 1.5))),
      );
      warp.current = (t0.far ? 1 : 0.35) * Math.sin(Math.PI * raw) ** 1.5;
      if (raw - lastProgress.current > 0.05 || raw === 1) {
        lastProgress.current = raw;
        setPhase(raw === 1 ? "cruise" : "travel", raw);
      }
      if (raw === 1) {
        trip.current = null;
        lastProgress.current = 0;
      }
    } else {
      camera.position.lerp(target, Math.min(1, dt * 3));
      look.current.lerp(p.center, Math.min(1, dt * 3));
      warp.current = 0;
    }
    camera.lookAt(look.current);
    fitClipRange(camera as THREE.PerspectiveCamera, p.dist);
    updateTelemetry(dest, orbits, p, t0, dt);
  });

  /** 계기판의 진짜 값: 위치·지구 거리·고도·속도·남은 거리·보는 방향 */
  function updateTelemetry(
    dest: Destination,
    orbits: SkyCatalog["orbits"],
    p: Pose,
    t0: typeof trip.current,
    dt: number,
  ) {
    const now = Date.now();
    const toReal = realPositionAU(dest, orbits, now);
    const earth = DESTINATION_BY_ID.get("earth") as Destination;
    const earthReal = realPositionAU(earth, orbits, now);
    let cur: Vec3 = toReal;
    if (t0) {
      const raw = Math.min(1, (performance.now() - t0.start) / t0.duration);
      const e = easeInOut(raw);
      cur = [0, 1, 2].map(
        (i) =>
          (t0.fromReal[i] ?? 0) +
          ((toReal[i] ?? 0) - (t0.fromReal[i] ?? 0)) * e,
      ) as Vec3;
      telemetry.remainingKm = distanceKm(cur, toReal);
      telemetry.progress = raw;
    } else {
      telemetry.remainingKm = 0;
      telemetry.progress = 1;
    }
    const prev = lastReal.current;
    telemetry.speedKmS = t0 && prev && dt > 0 ? distanceKm(prev, cur) / dt : 0;
    lastReal.current = cur;
    telemetry.traveling = Boolean(t0);
    telemetry.position = cur;
    const body = dest.body ? BODY_BY_ID.get(dest.body) : undefined;
    const realR = body ? REAL_RADIUS_KM[body.id] : undefined;
    telemetry.altitudeKm =
      !t0 && body && realR
        ? Math.max(
            0,
            (camera.position.distanceTo(p.center) / body.radius - 1) * realR,
          )
        : null;
    telemetry.earthKm =
      dest.id === "earth" && !t0
        ? (telemetry.altitudeKm ?? 0)
        : distanceKm(cur, earthReal);
    camera.getWorldDirection(camDir);
    telemetry.view = directionToCoords([camDir.x, camDir.y, camDir.z]);
  }

  // 마우스가 가리키는 하늘의 좌표
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Vector3();
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ray
        .set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
          0.5,
        )
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      telemetry.cursor = directionToCoords([ray.x, ray.y, ray.z]);
    };
    const onLeave = () => {
      telemetry.cursor = null;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera]);
  return null;
}

// ── 이름표 ──────────────────────────────────────────

type LabelSpec = {
  key: string;
  text: string;
  kind: "star" | "constellation" | "body" | "sun";
  /** 하늘 방향이면 dir, 장면 위치면 at() */
  dir?: THREE.Vector3;
  at?: () => THREE.Vector3;
  body?: BodyDef;
  /** 누르면 날아갈 목적지 */
  target?: string;
};

/** 이름표 별 중 목적지가 있는 것 */
const STAR_TARGET: Record<string, string> = {
  Sirius: "sirius",
  Vega: "vega",
  Betelgeuse: "betelgeuse",
  Antares: "antares",
  Polaris: "polaris",
  "Rigil Kentaurus": "alpha-cen",
};

const LABEL_STYLE: Record<LabelSpec["kind"], string> = {
  star: "font-size:11px;color:rgba(235,240,255,.72);",
  constellation:
    "font-size:11px;letter-spacing:.18em;color:rgba(140,170,255,.55);",
  body: "font-size:12.5px;color:rgba(255,236,200,.92);font-weight:600;",
  sun: "font-size:12px;color:rgba(255,220,160,.9);font-weight:600;",
};

function LabelLayer({
  catalog,
  container,
  amount,
  onPick,
}: {
  catalog: SkyCatalog;
  container: RefObject<HTMLDivElement | null>;
  amount: "few" | "all";
  onPick?: (id: string) => void;
}) {
  const { camera, gl } = useThree();
  const nodes = useRef<Map<string, HTMLSpanElement>>(new Map());

  const specs = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = [];
    const magLimit = amount === "all" ? 2.4 : 1.4;
    for (const s of catalog.named) {
      if (s.mag > magLimit) continue;
      const [x, y, z] = toThree(raDecToEcliptic(s.ra, s.dec));
      out.push({
        key: `s-${s.hip}`,
        text: s.ko,
        kind: "star",
        target: STAR_TARGET[s.en],
        dir: new THREE.Vector3(x, y, z),
      });
    }
    for (const c of catalog.constellations) {
      if (amount === "few" && c.rank > 1) continue;
      const [x, y, z] = toThree(raDecToEcliptic(c.label[0], c.label[1]));
      out.push({
        key: `c-${c.id}`,
        text: c.ko,
        kind: "constellation",
        dir: new THREE.Vector3(x, y, z),
      });
    }
    for (const b of BODIES) {
      if (b.id === "sun") continue;
      out.push({
        key: `b-${b.id}`,
        text: b.ko,
        kind: "body",
        body: b,
        target: DESTINATION_BY_ID.has(b.id) ? b.id : undefined,
        at: () =>
          new THREE.Vector3(...bodyPosition(b, catalog.orbits, Date.now())),
      });
    }
    out.push({
      key: "sun",
      text: "태양",
      kind: "sun",
      target: "sun",
      at: () => new THREE.Vector3(),
    });
    out.push({
      key: "halley",
      text: "핼리 혜성",
      kind: "body",
      target: "halley",
      at: () =>
        new THREE.Vector3(
          ...halleyPosition(HALLEY.perihelion + 10 * 86_400_000),
        ),
    });
    for (const p of PROBES) {
      out.push({
        key: `p-${p.id}`,
        text: p.ko,
        kind: "body",
        target: p.id,
        at: () => new THREE.Vector3(...probePosition(p.id, Date.now())),
      });
    }
    return out;
  }, [catalog, amount]);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const map = nodes.current;
    for (const s of specs) {
      const el = document.createElement("span");
      el.textContent = s.text;
      // cssText가 앞서 넣은 스타일을 덮으므로 먼저 넣는다.
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;text-shadow:0 0 6px #000,0 0 2px #000;will-change:transform;transition:opacity .3s;${LABEL_STYLE[s.kind]}`;
      const target = s.target;
      if (onPick && target) {
        // 이름표를 눌러도 그곳으로 날아간다.
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.title = `${s.text}(으)로 가기`;
        el.addEventListener("click", () => onPick(target));
      }
      root.appendChild(el);
      map.set(s.key, el);
    }
    return () => {
      for (const el of map.values()) el.remove();
      map.clear();
    };
  }, [specs, container, onPick]);

  const v = useMemo(() => new THREE.Vector3(), []);
  // 행성 이름표가 먼저 자리를 잡고, 별·별자리는 남는 자리에.
  const ordered = useMemo(() => {
    const rank = { body: 0, sun: 0, star: 1, constellation: 2 } as const;
    return [...specs].sort((a, b) => rank[a.kind] - rank[b.kind]);
  }, [specs]);
  const occluderBodies = useMemo(
    () => [
      ...BODIES.map((b) => ({
        r: b.radius,
        at: () =>
          new THREE.Vector3(...bodyPosition(b, catalog.orbits, Date.now())),
      })),
      ...DESTINATIONS.filter((d) => d.star).map((d) => {
        const p = starTargetPosition(d);
        return { r: d.star?.radius ?? 1, at: () => p };
      }),
    ],
    [catalog],
  );

  useFrame(() => {
    const w = gl.domElement.clientWidth;
    const h = gl.domElement.clientHeight;
    const camDist = camera.position.length();
    const focal =
      h /
      2 /
      Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    // 화면에서 천체가 차지하는 원(이름표를 가리는 것)
    const discs: { x: number; y: number; r: number; d: number }[] = [];
    for (const o of occluderBodies) {
      const p = o.at();
      const d = camera.position.distanceTo(p);
      const rpx = (o.r / d) * focal;
      if (rpx < 5) continue;
      v.copy(p).project(camera);
      if (v.z >= 1) continue;
      discs.push({
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        r: rpx,
        d,
      });
    }
    const placed: { x: number; y: number; hw: number }[] = [];
    for (const s of ordered) {
      const el = nodes.current.get(s.key);
      if (!el) continue;
      let show = true;
      let offsetY = 8;
      let depth = Number.POSITIVE_INFINITY;
      if (s.dir) {
        v.copy(s.dir).multiplyScalar(1000).add(camera.position);
      } else if (s.at) {
        v.copy(s.at());
        const d = camera.position.distanceTo(v);
        depth = d;
        const r = s.body?.radius ?? 0.1;
        // 너무 가까우면(화면을 채우면) 이름표를 숨기고, 너무 멀면 행성만 남긴다.
        const apparent = r / d;
        if (s.kind === "body") {
          const isMoon = Boolean(s.body?.parent);
          show =
            apparent < 0.08 &&
            (isMoon ? d < moonLabelRange() : d < 6000 * rangeScale());
          offsetY = Math.max(8, apparent * h * 0.6 + 6);
        } else {
          show = camDist > 25;
        }
      }
      v.project(camera);
      const visible =
        show && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (!visible) {
        el.style.opacity = "0";
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      // 더 가까운 천체 뒤에 있으면 숨긴다(자기 자신은 제외: 0.99).
      const hidden = discs.some(
        (c) => c.d < depth * 0.99 && Math.hypot(c.x - x, c.y - y) < c.r * 1.05,
      );
      const hw = (el.offsetWidth || 40) / 2;
      const ly = y + offsetY;
      const overlaps = placed.some(
        (p) => Math.abs(p.x - x) < p.hw + hw + 4 && Math.abs(p.y - ly) < 15,
      );
      if (hidden || overlaps) {
        el.style.opacity = "0";
        continue;
      }
      placed.push({ x, y: ly, hw });
      el.style.opacity = "1";
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y + offsetY).toFixed(1)}px) translateX(-50%)`;
    }
  });
  return null;
}

// ── 워프 줄기(2D 덧그림) ───────────────────────────────

function useWarpStreaks(
  ref: RefObject<HTMLCanvasElement | null>,
  warp: RefObject<number>,
) {
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rand = mulberry32(3);
    const streaks = Array.from({ length: 260 }, () => ({
      a: rand() * Math.PI * 2,
      r: rand(),
      speed: 0.4 + rand(),
      hue: 200 + rand() * 40,
    }));
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * devicePixelRatio) {
        canvas.width = w * devicePixelRatio;
        canvas.height = h * devicePixelRatio;
      }
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const k = warp.current ?? 0;
      if (k < 0.01) return;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(w, h) / 2;
      ctx.lineCap = "round";
      for (const s of streaks) {
        s.r += 0.012 * s.speed * (0.3 + k * 2.5);
        if (s.r > 1) s.r = 0.02 + rand() * 0.1;
        const r0 = s.r * maxR;
        const len = (20 + 260 * k * k) * s.r * s.speed;
        const x0 = cx + Math.cos(s.a) * r0;
        const y0 = cy + Math.sin(s.a) * r0;
        const x1 = cx + Math.cos(s.a) * (r0 + len);
        const y1 = cy + Math.sin(s.a) * (r0 + len);
        ctx.strokeStyle = `hsla(${s.hue}, 90%, 85%, ${0.55 * k * s.r})`;
        ctx.lineWidth = 0.6 + 1.6 * k * s.r;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ref, warp]);
}

/** 적도 좌표 격자: 적경 2시간(30도)마다 자오선, 적위 15도마다 위선. */
function equatorialGrid() {
  const pts: number[] = [];
  const r = SKY_RADIUS * 0.985;
  for (let ra = 0; ra < 360; ra += 30) {
    for (let dec = -88; dec < 88; dec += 4) {
      pts.push(...skyPoint(ra, dec, r), ...skyPoint(ra, dec + 4, r));
    }
  }
  for (let dec = -75; dec <= 75; dec += 15) {
    for (let ra = 0; ra < 360; ra += 4) {
      pts.push(...skyPoint(ra, dec, r), ...skyPoint(ra + 4, dec, r));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}
