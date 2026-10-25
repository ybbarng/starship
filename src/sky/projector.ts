// 창밖 카메라를 다른 부품(교신선, 이벤트)이 쓸 수 있게 내준다. SpaceView가 매 프레임 채운다.
import * as THREE from "three";
import { raDecToEcliptic, toThree } from "./astro";

export const projector: {
  camera: THREE.PerspectiveCamera | null;
  width: number;
  height: number;
} = { camera: null, width: 0, height: 0 };

const v = new THREE.Vector3();

export type ScreenPoint = { x: number; y: number; visible: boolean };

/** 하늘의 한 방향(적경·적위, 도)이 창 안 어디에 보이나 */
export function projectSky(raDeg: number, decDeg: number): ScreenPoint {
  const cam = projector.camera;
  if (!cam) return { x: 0, y: 0, visible: false };
  const [x, y, z] = toThree(raDecToEcliptic(raDeg, decDeg));
  v.set(x, y, z).multiplyScalar(1000).add(cam.position).project(cam);
  return {
    x: (v.x * 0.5 + 0.5) * projector.width,
    y: (-v.y * 0.5 + 0.5) * projector.height,
    visible: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1,
  };
}
