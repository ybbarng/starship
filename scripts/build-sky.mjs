// d3-celestial(BSD-3-Clause) 데이터에서 화면이 쓰는 작은 하늘 파일을 만든다.
// 결과: public/sky/sky.json. 출처와 라이선스는 docs/ASSETS.md.
//   pnpm sky:build
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dataDir = join(
  dirname(require.resolve("d3-celestial/package.json")),
  "data",
);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

// GeoJSON 경도(-180..180)를 적경(0..360도)으로.
const ra = (lon) => (lon < 0 ? lon + 360 : lon);
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;

const stars = read("stars.6.json").features;
const names = read("starnames.json");

// 별: [적경, 적위, 등급, B-V 색지수]
const starRows = stars
  .map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const bv = Number.parseFloat(f.properties.bv);
    return [
      r3(ra(lon)),
      r3(lat),
      r2(f.properties.mag),
      Number.isFinite(bv) ? r2(bv) : 0.6,
    ];
  })
  .sort((a, b) => a[2] - b[2]);

// 이름표: 고유 이름이 있고 3등급보다 밝은 별
const named = stars
  .filter((f) => f.properties.mag <= 3.0 && names[f.id]?.name)
  .map((f) => {
    const n = names[f.id];
    const [lon, lat] = f.geometry.coordinates;
    return {
      hip: f.id,
      ra: r3(ra(lon)),
      dec: r3(lat),
      mag: r2(f.properties.mag),
      en: n.name,
      ko: n.ko || n.name,
      con: n.c || "",
    };
  })
  .sort((a, b) => a.mag - b.mag);

const conInfo = new Map(
  read("constellations.json").features.map((f) => [f.id, f]),
);
const constellations = read("constellations.lines.json").features.map((f) => {
  const info = conInfo.get(f.id);
  const [lon, lat] = info?.geometry.coordinates ?? [0, 0];
  return {
    id: f.id,
    en: info?.properties.en ?? f.id,
    ko: info?.properties.ko ?? f.id,
    rank: Number(info?.properties.rank ?? 3),
    label: [r2(ra(lon)), r2(lat)],
    lines: f.geometry.coordinates.map((line) =>
      line.map(([x, y]) => [r3(ra(x)), r3(y)]),
    ),
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
  source:
    "d3-celestial 0.7.35 (BSD-3-Clause); stars: XHIP / Hipparcos; lines: IAU",
  stars: starRows,
  named,
  constellations,
  orbits,
};
writeFileSync(join(root, "public/sky/sky.json"), JSON.stringify(out));
console.log(
  `stars ${starRows.length}, named ${named.length}, constellations ${constellations.length}, orbits ${BODIES.length}`,
);
