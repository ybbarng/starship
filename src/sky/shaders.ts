// 창밖 우주를 그리는 GLSL 셰이더. 외부 텍스처 없이 노이즈로 표면을 만든다.

const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 5; k++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
`;

export const starVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aSeed;
uniform float uPixelRatio;
uniform float uTime;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.85 + 0.15 * sin(uTime * (1.3 + aSeed * 2.1) + aSeed * 40.0);
  gl_PointSize = aSize * uPixelRatio * uScale * mix(1.0, tw, step(1.5, aSize));
  vColor = aColor;
  vAlpha = clamp(aSize / 2.2, 0.25, 1.0);
}
`;

export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 9.0);
  float halo = exp(-r * 3.2) * 0.35;
  gl_FragColor = vec4(vColor * (core + halo) + core * 0.35, (core + halo) * vAlpha);
}
`;

export const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float g = exp(-r * 4.0) * 0.9 + exp(-r * 1.6) * 0.25;
  g *= smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(uColor * g * uIntensity, g * uIntensity);
}
`;

export const planetVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
varying vec2 vUv;
void main() {
  vLocal = normalize(position);
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const planetFragment = /* glsl */ `
${NOISE}
uniform int uType; // 1 바위 2 지구 3 기체 4 얼음 5 화산 6 갈라진 얼음
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uAtmo;
uniform float uHasAtmo;
uniform float uBands;
uniform float uStorm;
uniform float uCraters;
uniform float uSeed;
uniform float uTime;
uniform vec3 uSunPos;
uniform sampler2D uMap;
uniform float uHasMap;
uniform sampler2D uNight;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
varying vec2 vUv;

vec3 surface(vec3 p, out float night) {
  night = 0.0;
  float lat = p.y;
  vec3 q = p * 2.0 + uSeed;
  if (uType == 1) {
    float n = fbm(q * 1.5);
    vec3 c = mix(uC3, uC1, smoothstep(0.25, 0.55, n));
    c = mix(c, uC2, smoothstep(0.55, 0.8, fbm(q * 3.0 + 4.0)));
    if (uCraters > 0.5) {
      float cr = vnoise(q * 7.0);
      c *= 1.0 - 0.25 * smoothstep(0.72, 0.8, cr) + 0.12 * smoothstep(0.8, 0.86, cr);
    }
    return c;
  }
  if (uType == 2) {
    float land = fbm(q * 1.2);
    float isLand = smoothstep(0.5, 0.53, land);
    vec3 c = mix(uC1, uC2 * (0.8 + 0.4 * fbm(q * 5.0)), isLand);
    c = mix(c, uC3, smoothstep(0.93, 0.97, abs(lat)));
    night = isLand * smoothstep(0.8, 0.88, vnoise(q * 55.0)) * (1.0 - smoothstep(0.7, 0.8, abs(lat)));
    return c;
  }
  if (uType == 3) {
    float w = fbm(vec3(p.x * 2.0, lat * 1.0, p.z * 2.0) + uTime * 0.01);
    float b = sin(lat * uBands + w * 3.0);
    vec3 c = mix(uC1, uC2, smoothstep(-0.4, 0.6, b));
    c = mix(c, uC3, smoothstep(0.7, 1.0, sin(lat * uBands * 0.5 + w * 5.0)) * 0.6);
    if (uStorm > 0.5) {
      vec2 sp = vec2(atan(p.z, p.x) - 0.6, (lat + 0.32) * 3.2);
      float s = length(sp * vec2(1.6, 1.0));
      c = mix(c, uC3 * 1.15, smoothstep(0.32, 0.18, s));
    }
    return c;
  }
  if (uType == 4) {
    float n = fbm(q * 0.8);
    return mix(uC1, uC2, smoothstep(-0.6, 0.8, lat + n * 0.3)) * (0.92 + 0.12 * n);
  }
  if (uType == 5) {
    float n = fbm(q * 2.0);
    vec3 c = mix(uC1, uC3, smoothstep(0.4, 0.7, n));
    c = mix(c, uC2 * 0.6, smoothstep(0.7, 0.75, vnoise(q * 6.0)));
    return c;
  }
  float n = fbm(q * 1.4);
  vec3 c = mix(uC3, uC1, n);
  float crack = 1.0 - smoothstep(0.0, 0.02, abs(fbm(q * 2.5) - 0.5));
  return mix(c, uC2, crack * 0.8);
}

void main() {
  vec3 n = normalize(vNormalW);
  vec3 L = normalize(uSunPos - vPosW);
  vec3 V = normalize(cameraPosition - vPosW);
  float night;
  vec3 base = surface(vLocal, night);
  if (uHasMap > 0.5) base = texture2D(uMap, vUv).rgb;
  float diff = max(dot(n, L), 0.0);
  float wrap = smoothstep(-0.08, 0.25, dot(n, L));
  vec3 col = base * (0.035 + 1.05 * diff * wrap);
  if (uType == 2 && uHasMap > 0.5) {
    // 사진 지구: 밤 쪽에 도시 불빛, 바다에 햇빛 반짝임. 구름은 따로 한 겹 더 그린다.
    float dark = 1.0 - smoothstep(-0.15, 0.06, dot(n, L));
    col += texture2D(uNight, vUv).rgb * vec3(1.0, 0.85, 0.6) * dark * 1.3;
    float water = smoothstep(0.12, 0.02, base.g - base.b * 0.6);
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, H), 0.0), 60.0) * water * 0.6 * wrap;
  } else if (uType == 2) {
    float cl = smoothstep(0.55, 0.72, fbm(vLocal * 4.0 + vec3(uTime * 0.004, 0.0, 0.0)));
    col = mix(col, vec3(1.0) * (0.04 + diff), cl * 0.85);
    col += vec3(1.0, 0.78, 0.45) * night * (1.0 - smoothstep(-0.15, 0.05, dot(n, L))) * 0.9 * (1.0 - cl);
  }
  if (uHasAtmo > 0.5) {
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    col += uAtmo * rim * smoothstep(-0.3, 0.4, dot(n, L)) * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const sunFragment = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uTint;
uniform float uIsStar;
uniform sampler2D uMap;
uniform float uHasMap;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
varying vec2 vUv;
void main() {
  vec3 V = normalize(cameraPosition - vPosW);
  float mu = max(dot(normalize(vNormalW), V), 0.0);
  float g = fbm(vLocal * 9.0 + uTime * 0.05);
  vec3 hot = vec3(1.0, 0.93, 0.7);
  vec3 warm = vec3(1.0, 0.6, 0.18);
  vec3 c = uIsStar > 0.5
    ? uTint * (0.7 + 0.5 * g) * (0.45 + 0.55 * pow(mu, 0.6))
    : mix(warm, hot, g) * (0.55 + 0.45 * pow(mu, 0.5));
  if (uHasMap > 0.5 && uIsStar < 0.5) {
    c = texture2D(uMap, vUv).rgb * (0.6 + 0.3 * g) * (0.6 + 0.5 * pow(mu, 0.5)) * 1.2;
  }
  gl_FragColor = vec4(c * 1.15, 1.0);
}
`;

export const ringVertex = /* glsl */ `
varying vec3 vPosW;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const ringFragment = /* glsl */ `
${NOISE}
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform vec3 uSunPos;
uniform vec3 uPlanetPos;
uniform float uPlanetRadius;
uniform sampler2D uMap;
uniform float uHasMap;
varying vec3 vPosW;
varying vec3 vLocal;
void main() {
  float r = length(vLocal.xy);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float bands = 0.55 + 0.45 * sin(t * 90.0 + vnoise(vec3(t * 40.0)) * 4.0);
  float gap = 1.0 - smoothstep(0.0, 0.02, abs(t - 0.62)) * 0.9;
  float a = bands * gap * smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t) * 0.8;
  vec3 ringColor = uColor;
  if (uHasMap > 0.5) {
    vec4 tx = texture2D(uMap, vec2(t, 0.5));
    ringColor = tx.rgb;
    a = tx.a;
  }
  // 행성 그림자
  vec3 L = normalize(uSunPos - vPosW);
  vec3 toP = uPlanetPos - vPosW;
  float along = dot(toP, L);
  float dist = length(toP - L * along);
  float shadow = along > 0.0 ? smoothstep(uPlanetRadius * 0.95, uPlanetRadius * 1.05, dist) : 1.0;
  vec3 c = ringColor * (0.25 + 0.75 * shadow);
  gl_FragColor = vec4(c, a);
}
`;

export const tailVertex = /* glsl */ `
attribute float aT;
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uDir;
uniform vec3 uSide;
uniform float uLength;
uniform float uCurve;
uniform float uSpread;
varying float vFade;
void main() {
  float t = fract(aT + uTime * 0.03 * (0.6 + aSeed));
  vec3 p = position + uDir * t * uLength + uSide * (uCurve * t * t * uLength);
  vec3 perp = normalize(cross(uDir, vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(perp, uDir));
  float s = uSpread * t * uLength;
  float h1 = fract(sin(aSeed * 91.7) * 43758.5453);
  float h2 = fract(sin(aSeed * 47.3 + 1.3) * 24634.6345);
  p += perp * (h1 - 0.5) * s + up * (h2 - 0.5) * s;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPixelRatio * (6.0 + 30.0 * t) * (10.0 / -mv.z);
  vFade = (1.0 - t) * smoothstep(0.0, 0.05, t);
}
`;

export const tailFragment = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = exp(-r * r * 3.0) * vFade * 0.22;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/** 은하수용: 가운데 심 없이 부드럽게 퍼지는 점 */
export const softFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float g = exp(-r * r * 4.0);
  gl_FragColor = vec4(vColor * g, g);
}
`;

/** 지구 구름 한 겹: 구름 지도의 밝기를 투명도로 쓴다. */
export const cloudFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSunPos;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 L = normalize(uSunPos - vPosW);
  float lit = smoothstep(-0.1, 0.35, dot(n, L));
  float a = texture2D(uMap, vUv).r;
  gl_FragColor = vec4(vec3(0.03 + 0.97 * lit), a * 0.92);
}
`;
