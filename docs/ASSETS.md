# 외부 자료와 라이선스

공개 배포할 수 있는 라이선스만 들인다. 새 자료를 들이기 전에 여기에 출처·라이선스·쓰는 곳을 적는다.

| 자료 | 출처 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| 별 위치·밝기·색(6등급까지 5,044개) | [d3-celestial](https://github.com/ofrohn/d3-celestial) 0.7.35 `stars.6.json` (원자료: XHIP, Anderson & Francis 2012 / Hipparcos) | BSD-3-Clause | `public/sky/sky.json` |
| 별 이름(한국어 포함) | d3-celestial `starnames.json` (번역: Stellarium skycultures) | BSD-3-Clause | 같은 파일 |
| 별자리 선·별자리 이름 | d3-celestial `constellations.lines.json`, `constellations.json` (원자료: IAU) | BSD-3-Clause | 같은 파일 |
| 행성·소행성 궤도 요소 | d3-celestial `planets.json` (원자료: JPL "Keplerian Elements for Approximate Positions of the Major Planets") | BSD-3-Clause | 같은 파일 |
| 글꼴 Pretendard | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) 1.3.9 (npm) | SIL OFL 1.1 | 전체 화면 |

`public/sky/sky.json`은 `pnpm sky:build`(`scripts/build-sky.mjs`)가 d3-celestial 패키지에서 만든다. d3-celestial 저작권 고지:

> Copyright (c) 2015, Olaf Frohn. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that the conditions of the BSD 3-Clause License are met.

## 들이지 않은 것

- d3-celestial의 은하수 윤곽(`mw.json`): 원자료(Jose R. Vieira) 라이선스가 분명하지 않아 쓰지 않는다. 은하수는 코드로 그린다.
- 영화·드라마·책·게임 속 캐릭터와 함선: 저작권·상표 문제로 쓰지 않는다. 이벤트의 외계인(모아·포포·도르·끙)은 모두 이 저장소에서 지어냈다.

## 행성 표면

기본은 코드(셰이더)로 그린다. 사진 텍스처는 나중에 고를 수 있게 남겨 둔다: `NEXT_PUBLIC_PLANET_TEXTURES`에 텍스처 폴더 주소(예: `/textures`)를 주면 `{id}.jpg`(예: `jup.jpg`)를 읽어 쓴다. 텍스처 파일은 저장소에 넣지 않는다. 쓰려면 라이선스가 맞는 것(예: Solar System Scope, CC BY 4.0 — 출처 표기 필요)을 직접 받아 둔다.
