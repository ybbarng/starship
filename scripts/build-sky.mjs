// d3-celestial(BSD-3-Clause)과 Hipparcos 새 처리판(van Leeuwen 2007, CDS I/311) 시차로 화면이 쓰는 하늘 파일을 만든다.
// 결과: public/sky/sky.json(맨눈 별 + 거리, 이름, 별자리, 궤도), public/sky/faint.json(6~8등급 별).
// 출처와 라이선스는 docs/ASSETS.md, 설계는 docs/sky-3d.md.
//   pnpm sky:build
// 시차 원자료(hip2.dat, 33MB)는 저장소에 넣지 않는다. HIP2_DAT로 경로를 주거나, 없으면 .cache/hip2.dat에
// CDS에서 받아 둔다. 받은 파일은 SHA-256으로 원본과 같은지 확인한다.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { matchVertex, parseHip2 } from "../src/sky/skyData.ts";

const require = createRequire(import.meta.url);
const dataDir = join(
  dirname(require.resolve("d3-celestial/package.json")),
  "data",
);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

const HIP2_URL = "https://cdsarc.cds.unistra.fr/ftp/I/311/hip2.dat.gz";
/** 압축을 푼 hip2.dat(117,955줄)의 SHA-256 */
const HIP2_SHA256 =
  "c45d6325bd59dd691764af173a9702e543804a2b6c1d9fea59210e8332e50a4a";

async function loadHip2() {
  const path = process.env.HIP2_DAT ?? join(root, ".cache/hip2.dat");
  if (!existsSync(path)) {
    console.log(`hip2.dat이 없어 받는다: ${HIP2_URL}`);
    const res = await fetch(HIP2_URL);
    if (!res.ok) throw new Error(`hip2.dat.gz ${res.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, gunzipSync(Buffer.from(await res.arrayBuffer())));
  }
  const buf = readFileSync(path);
  const sum = createHash("sha256").update(buf).digest("hex");
  if (sum !== HIP2_SHA256)
    throw new Error(`hip2.dat 체크섬이 다르다(${sum}). 원본을 다시 받는다.`);
  return parseHip2(buf.toString("utf8"));
}

// GeoJSON 경도(-180..180)를 적경(0..360도)으로.
const ra = (lon) => (lon < 0 ? lon + 360 : lon);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const bvOf = (f) => {
  const bv = Number.parseFloat(f.properties.bv);
  return Number.isFinite(bv) ? bv : 0.6;
};
const point = (f) => ({
  hip: f.id,
  ra: ra(f.geometry.coordinates[0]),
  dec: f.geometry.coordinates[1],
});

const parallax = await loadHip2();
const bright = read("stars.6.json").features;
const all = read("stars.8.json").features;
const names = read("starnames.json");

// 별자리 선 꼭짓점을 별과 맞춘다: 맨눈 별에서 먼저, 없으면 8등급까지(고래자리 미라처럼 밝기가 변하는 별).
const MATCH_DEG = 0.05;
const brightIds = new Set(bright.map((f) => f.id));
const brightPts = bright.map(point);
const faintPts = all.filter((f) => !brightIds.has(f.id)).map(point);
const rawLines = read("constellations.lines.json").features;
let unmatched = 0;
const lineHips = new Map(
  rawLines.map((f) => [
    f.id,
    f.geometry.coordinates.map((line) =>
      line.map(([x, y]) => {
        const hip = matchVertex(ra(x), y, [brightPts, faintPts], MATCH_DEG);
        if (!hip) unmatched++;
        return hip;
      }),
    ),
  ]),
);
const vertexHips = new Set([...lineHips.values()].flat(2).filter(Boolean));

// 거리를 붙여 3D로 두는 별: 맨눈 별 전부와 별자리 꼭짓점인 흐린 별.
// [적경, 적위, 등급, B-V, HIP, 시차(mas), 시차 오차(mas)]. 시차가 없으면 0, 0.
const near = all.filter((f) => brightIds.has(f.id) || vertexHips.has(f.id));
const nearIds = new Set(near.map((f) => f.id));
const starRows = near
  .map((f) => {
    const [plx, ePlx] = parallax.get(f.id) ?? [0, 0];
    const p = point(f);
    return [
      r3(p.ra),
      r3(p.dec),
      r2(f.properties.mag),
      r2(bvOf(f)),
      f.id,
      plx,
      ePlx,
    ];
  })
  .sort((a, b) => a[2] - b[2]);

// 6~8등급: 거리 없이 먼 천구에. 평평한 배열 [적경, 적위, 등급, B-V, ...]
const faint = all
  .filter((f) => !nearIds.has(f.id))
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .flatMap((f) => {
    const p = point(f);
    return [r2(p.ra), r2(p.dec), r1(f.properties.mag), r1(bvOf(f))];
  });

// 이름표: 고유 이름이 있고 3등급보다 밝은 별
const named = bright
  .filter((f) => f.properties.mag <= 3.0 && names[f.id]?.name)
  .map((f) => {
    const n = names[f.id];
    const p = point(f);
    return {
      hip: f.id,
      ra: r3(p.ra),
      dec: r3(p.dec),
      mag: r2(f.properties.mag),
      en: n.name,
      ko: n.ko || n.name,
      con: n.c || "",
    };
  })
  .sort((a, b) => a.mag - b.mag);

// 원자료의 한국어 이름 오류를 바로잡는다.
const KO_FIX = { Crv: "까마귀자리" };

const conInfo = new Map(
  read("constellations.json").features.map((f) => [f.id, f]),
);
const constellations = rawLines.map((f) => {
  const info = conInfo.get(f.id);
  const [lon, lat] = info?.geometry.coordinates ?? [0, 0];
  return {
    id: f.id,
    en: info?.properties.en ?? f.id,
    ko: KO_FIX[f.id] ?? info?.properties.ko ?? f.id,
    rank: Number(info?.properties.rank ?? 3),
    label: [r2(ra(lon)), r2(lat)],
    lines: f.geometry.coordinates.map((line) =>
      line.map(([x, y]) => [r3(ra(x)), r3(y)]),
    ),
    // lines와 같은 모양. 꼭짓점마다 맞춘 별의 HIP, 못 맞추면 0.
    hips: lineHips.get(f.id),
  };
});

const planets = read("planets.json");
const BODIES = [
  "mer",
  "ven",
  "ter",
  "mar",
  "jup",
  "sat",
  "ura",
  "nep",
  "plu",
  "cer",
  "ves",
];
const orbits = Object.fromEntries(
  BODIES.map((id) => [id, planets[id].elements[0]]),
);

const out = {
  version: 2,
  source:
    "d3-celestial 0.7.35 (BSD-3-Clause): stars (XHIP/Hipparcos), names, IAU lines, orbits; parallax: Hipparcos new reduction, van Leeuwen 2007 (CDS I/311)",
  stars: starRows,
  named,
  constellations,
  orbits,
};
writeFileSync(join(root, "public/sky/sky.json"), JSON.stringify(out));
writeFileSync(
  join(root, "public/sky/faint.json"),
  JSON.stringify({
    source: "d3-celestial 0.7.35 stars.8.json (BSD-3-Clause), 6~8등급",
    stars: faint,
  }),
);
const withPlx = starRows.filter((r) => r[5] !== 0 || r[6] !== 0).length;
console.log(
  `stars ${starRows.length} (시차 ${withPlx}), faint ${faint.length / 4}, named ${named.length}, constellations ${constellations.length}, 못 맞춘 꼭짓점 ${unmatched}, orbits ${BODIES.length}`,
);
