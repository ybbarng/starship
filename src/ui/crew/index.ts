import type { CrewStatus } from "@/protocol/v1";
import { ANIMAL_KINDS, type AnimalKind, type Pose } from "./Animal";

export {
  ANIMAL_KINDS,
  Animal,
  type AnimalContext,
  type AnimalKind,
  type AnimalProps,
  POSES,
  type Pose,
} from "./Animal";

/** 승무원 id로 늘 같은 동물을 고른다(FNV-1a 해시). */
export function animalFor(crewId: string): AnimalKind {
  let h = 0x811c9dc5;
  for (let i = 0; i < crewId.length; i++) {
    h ^= crewId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ANIMAL_KINDS[(h >>> 0) % ANIMAL_KINDS.length] ?? "cat";
}

const POSE_BY_STATUS: Record<CrewStatus, Pose> = {
  working: "work",
  "needs-you": "wave",
  idle: "sleep",
  off: "off",
};

/** 승무원 상태를 자세로 바꾼다. 나를 기다리면 손을 흔든다. */
export function poseFor(status: CrewStatus): Pose {
  return POSE_BY_STATUS[status];
}
