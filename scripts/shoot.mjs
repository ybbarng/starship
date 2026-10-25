// 설치된 Chrome으로 페이지를 열어 스크린숏을 찍고, 콘솔 오류를 보여 주고, 차례로 누른다.
//   node scripts/shoot.mjs <url> <out.png> [--wait 4000] [--size 1372x872]
//        [--click "<css 또는 text=글자>"]... [--after out2.png] [--scroll 900]
// 클릭마다 0.8초 쉬고, 마지막에 --after 경로로 한 장 더 찍는다. 토스트 글은 출력한다.
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
if (!url || !out) {
  console.error("사용법: node scripts/shoot.mjs <url> <out.png> [옵션]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const clicks = args.flatMap((a, i) => (a === "--click" ? [args[i + 1]] : []));
const [w, h] = opt("--size", "1372x872").split("x").map(Number);

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
});
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(opt("--wait", "4000")));
const scroll = opt("--scroll");
if (scroll) {
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.wheel(0, Number(scroll));
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
for (const sel of clicks) {
  try {
    await page.locator(sel).first().click({ timeout: 3000 });
    await page.waitForTimeout(800);
    const toast = await page
      .locator("[data-toast]")
      .allInnerTexts()
      .catch(() => []);
    console.log(
      `클릭 ${sel} → ${toast.length ? toast.join(" / ") : "(토스트 없음)"}`,
    );
  } catch (e) {
    console.log(`클릭 실패 ${sel}: ${e.message.split("\n")[0]}`);
  }
}
const after = opt("--after");
if (after) await page.screenshot({ path: after });
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
