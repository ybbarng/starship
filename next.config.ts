import type { NextConfig } from "next";

const config: NextConfig = {
  // 확인용 빌드는 STARSHIP_DIST_DIR=.next-check로 따로 둔다. 늘 켜 둔 앱(7790)이 쓰는 .next를 덮으면
  // 실행 중인 서버의 스크립트 파일이 사라져 화면이 비는 일이 생긴다(2026-11-01).
  distDir: process.env.STARSHIP_DIST_DIR || ".next",
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default config;
