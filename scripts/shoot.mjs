// 설치된 Chrome으로 페이지를 열어 스크린숏을 찍고, 콘솔 오류를 보여 주고, 차례로 누른다.
//   node scripts/shoot.mjs <url> <out.png> [--wait 4000] [--size 1372x872]
//        [--click "<css 또는 text=글자>"]... [--click-wait ms 또는 ms,ms,…(클릭마다, 모자라면 마지막 값)] [--after out2.png] [--after-wait ms] [--scroll 900] [--hover "<css>"]
//        [--wait-cruise [상한 ms, 기본 15000]]
// 클릭마다 0.8초 쉬고, 마지막에 --after 경로로 한 장 더 찍는다. 토스트 글은 출력한다.
// --wait-cruise: 찍기 전마다 창밖 하늘(SpaceView)의 data-voyage-phase가 cruise가 될 때까지 기다린다.
//   이동은 최대 7초라 기본 4초 뒤에 찍으면 별들 사이를 지나는 중간 하늘(긴 별자리 호)이 찍힌다.
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
const cruiseAt = args.indexOf("--wait-cruise");
const cruiseLimit =
  cruiseAt < 0
    ? 0
    : /^\d+$/.test(args[cruiseAt + 1] ?? "")
      ? Number(args[cruiseAt + 1])
      : 15000;

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
// 하늘이 cruise(이동 끝)가 될 때까지 기다린다. 하늘이 없는 화면은 바로 넘어간다.
const waitCruise = async () => {
  if (!cruiseLimit) return;
  const start = Date.now();
  const phase = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-voyage-phase]")).map((el) =>
        el.getAttribute("data-voyage-phase"),
      ),
    );
  let left = await phase();
  while (left.some((p) => p !== "cruise") && Date.now() - start < cruiseLimit) {
    await page.waitForTimeout(100);
    left = await phase();
  }
  if (left.some((p) => p !== "cruise"))
    console.log(`이동이 ${cruiseLimit}ms 안에 끝나지 않음: ${left.join(",")}`);
};
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(Number(opt("--wait", "4000")));
await waitCruise();
const scroll = opt("--scroll");
if (scroll) {
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.wheel(0, Number(scroll));
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
const waits = opt("--click-wait", "800").split(",").map(Number);
for (const [ci, sel] of clicks.entries()) {
  try {
    await page.locator(sel).first().click({ timeout: 3000 });
    // 클릭하려고 브라우저가 문서를 스크롤했으면 되돌린다(화면은 스크롤하지 않는 구조).
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      for (const el of document.querySelectorAll("body *"))
        if (el.scrollTop && !el.closest("[role=dialog]")) el.scrollTop = 0;
    });
    await page.waitForTimeout(waits[Math.min(ci, waits.length - 1)] ?? 800);
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
await page.waitForTimeout(Number(opt("--after-wait", "0")));
if (after) await waitCruise();
// --hover "<css>": 마우스를 올리고 0.2초 뒤에 찍는다(빠른 말풍선이 그 안에 뜨는지 본다).
const hover = opt("--hover");
if (hover) {
  await page.locator(hover).first().hover({ timeout: 3000 });
  await page.waitForTimeout(200);
}
if (after) await page.screenshot({ path: after });
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
