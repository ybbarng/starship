"use client";

// 태양이 앞에 보이면 유리창에 빛이 번진다. 태양이 화면 가운데에 가까울수록, 크게 보일수록 세고,
// 행성에 가려지면 사라진다. 그림은 캔버스 위 DOM 한 겹(그라디언트)으로 그려 장면 계산과 떨어뜨렸다.
import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useMemo } from "react";
import * as THREE from "three";
import { BODIES, BODY_BY_ID, type BodyDef, bodyPosition } from "./bodies";
import type { SkyCatalog } from "./catalog";

/** 태양 반대편으로 늘어서는 옅은 빛 원(렌즈·유리 반사): 태양→화면 가운데 선 위의 자리와 크기 */
const GHOSTS = [
  { at: 0.55, size: 46, alpha: 0.1 },
  { at: 1.25, size: 22, alpha: 0.14 },
  { at: 1.7, size: 80, alpha: 0.06 },
];

export function SunGlare({
  catalog,
  container,
}: {
  catalog: SkyCatalog;
  container: RefObject<HTMLDivElement | null>;
}) {
  const { camera, gl } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const sun = BODY_BY_ID.get("sun") as BodyDef;
  const others = useMemo(() => BODIES.filter((b) => b.id !== "sun"), []);

  useFrame(() => {
    const root = container.current;
    if (!root) return;
    const w = gl.domElement.clientWidth;
    const h = gl.domElement.clientHeight;
    const cam = camera as THREE.PerspectiveCamera;
    const focal = h / 2 / Math.tan((cam.fov * Math.PI) / 360);
    const sunDist = cam.position.length();
    v.set(0, 0, 0).project(cam);
    const behind = v.z >= 1;
    const x = (v.x * 0.5 + 0.5) * w;
    const y = (-v.y * 0.5 + 0.5) * h;
    // 화면 가운데에서 얼마나 떨어졌나(0 = 가운데, 1 = 가장자리 언저리)
    const off = Math.hypot(v.x, v.y);
    const facing = behind ? 0 : 1 - THREE.MathUtils.smoothstep(off, 0.15, 1.5);
    // 가까이서 크게 보일수록 세다. 멀어도 태양은 눈부시니 바닥을 둔다.
    const rpx = (sun.radius / Math.max(sunDist, 1e-6)) * focal;
    const size = THREE.MathUtils.clamp(rpx / 60, 0.45, 1);
    // 앞에 있는 행성이 태양 가운데를 가리면 끈다.
    let cover = 0;
    if (facing > 0) {
      const now = Date.now();
      for (const b of others) {
        const p = new THREE.Vector3(...bodyPosition(b, catalog.orbits, now));
        const d = cam.position.distanceTo(p);
        if (d >= sunDist) continue;
        const pr = (b.radius / d) * focal;
        if (pr < 2) continue;
        p.project(cam);
        const dx = (p.x * 0.5 + 0.5) * w - x;
        const dy = (-p.y * 0.5 + 0.5) * h - y;
        const inside =
          1 -
          THREE.MathUtils.smoothstep(Math.hypot(dx, dy), pr * 0.8, pr * 1.1);
        cover = Math.max(cover, inside);
      }
    }
    const k = facing * size * (1 - cover);
    if (k < 0.01) {
      root.style.opacity = "0";
      return;
    }
    root.style.opacity = "1";
    // 태양 둘레의 번짐 + 유리 전체가 아주 옅게 밝아짐
    const halo = `radial-gradient(circle at ${x.toFixed(0)}px ${y.toFixed(0)}px, rgba(255,246,228,${(0.55 * k).toFixed(3)}) 0, rgba(255,226,180,${(0.22 * k).toFixed(3)}) ${(60 + rpx).toFixed(0)}px, rgba(255,210,150,${(0.06 * k).toFixed(3)}) ${(260 + rpx * 2).toFixed(0)}px, transparent ${(560 + rpx * 3).toFixed(0)}px)`;
    const veil = `linear-gradient(rgba(255,240,220,${(0.05 * k).toFixed(3)}), rgba(255,240,220,${(0.05 * k).toFixed(3)}))`;
    // 태양 → 화면 가운데 → 반대편으로 늘어서는 빛 원
    const cx = w / 2;
    const cy = h / 2;
    const ghosts = GHOSTS.map((g) => {
      const gx = x + (cx - x) * (1 + g.at);
      const gy = y + (cy - y) * (1 + g.at);
      return `radial-gradient(circle at ${gx.toFixed(0)}px ${gy.toFixed(0)}px, rgba(200,225,255,${(g.alpha * k).toFixed(3)}) 0, rgba(200,225,255,${(g.alpha * 0.5 * k).toFixed(3)}) ${(g.size * 0.6).toFixed(0)}px, transparent ${g.size}px)`;
    });
    root.style.background = [halo, ...ghosts, veil].join(",");
  });
  return null;
}
