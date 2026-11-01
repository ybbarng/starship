// PWA 설치 정보(/manifest.webmanifest). Chrome "앱으로 설치"로 Starship을 따로 된 창에서 연다.
// 서비스 워커는 일부러 두지 않는다: 늘 켜 둔 앱이 새로 빌드돼도 옛 화면이 캐시에 남지 않게. 설계: docs/files.md.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Starship",
    short_name: "Starship",
    description: "AI 비서 세션들을 우주선 조종석에서 본다",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
