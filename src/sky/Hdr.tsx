"use client";

// HDR 렌더링: 장면을 넓은 밝기(HalfFloat)로 그린 뒤, 1.0을 넘는 빛(태양·항성 가운데)만 번지게 하고
// 마지막에 0.9 위쪽만 색 비율을 지키며 부드럽게 눌러 흰색에서 뚝 잘리지 않게 한다. 1.0 아래의 보통 색은
// 그대로라 기존 화면의 색감이 바뀌지 않는다. 주소에 ?hdr=0을 붙이면 끈다(전후 비교용).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/** 이 밝기를 넘는 빛만 번진다. 보통 색(≤1)은 번지지 않는다. */
const BLOOM_THRESHOLD = 1.0;
const BLOOM_STRENGTH = 0.6;
/** 좁게: 넓으면 태양 둘레에 둥근 안개 테두리가 생긴다(2026-11-01 사용자 피드백). 넓은 후광은 태양의 원래 빛무리가 맡는다. */
const BLOOM_RADIUS = 0.2;

/** 0.6까지는 그대로, 그 위는 1.0에 가까워지게 넓게 눌러 담는다(어깨 곡선). */
const KneeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    // 0.6부터 넓게 눌러 1~2 사이의 밝기 차(별 표면 쌀알 무늬)가 눈부심 속에서도 남게 한다.
    const float KNEE = 0.6;
    float shoulder(float x) {
      return x <= KNEE ? x : KNEE + (1.0 - KNEE) * (1.0 - exp(-(x - KNEE) / (1.0 - KNEE)));
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // 가장 밝은 채널을 기준으로 눌러 색 비율을 지킨다(붉은 거성은 붉게 밝다).
      float m = max(max(c.r, c.g), c.b);
      vec3 col = m > KNEE ? c * (shoulder(m) / m) : c;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/** 주소의 ?hdr=0이면 끈다. */
export function useHdrEnabled(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get("hdr") !== "0");
  }, []);
  return on;
}

/** Canvas 안에 두면 그 장면을 HDR로 그린다. 기본 그리기는 멈춘다(useFrame 우선순위 1). */
export function Hdr() {
  const { gl, scene, camera, size } = useThree();
  const { composer, bloom } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
    });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    // 번질 빛을 밝기(휘도) 대신 가장 센 채널로 고른다. 휘도는 빨강을 작게 쳐서
    // 붉은 거성(안타레스)이 넘쳐도 번지지 않았다(2026-11-01 피드백).
    b.materialHighPassFilter.fragmentShader = /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec3 defaultColor;
      uniform float defaultOpacity;
      uniform float luminosityThreshold;
      uniform float smoothWidth;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        float v = max(max(texel.r, texel.g), texel.b);
        float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
        gl_FragColor = mix(vec4(defaultColor, defaultOpacity), texel, alpha);
      }
    `;
    b.materialHighPassFilter.needsUpdate = true;
    c.addPass(b);
    c.addPass(new ShaderPass(KneeShader));
    return { composer: c, bloom: b };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    bloom.resolution.set(size.width, size.height);
  }, [composer, bloom, gl, size.width, size.height]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}
