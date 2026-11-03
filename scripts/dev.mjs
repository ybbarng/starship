// pnpm dev: next dev를 127.0.0.1:7790으로 띄우고, 실제로 묶은 주소를 STARSHIP_BIND로 넘긴다(2026-11-03).
// next dev는 서버를 자식 프로세스로 띄우며 -H를 넘기지 않아, 서버 쪽은 STARSHIP_BIND로만 묶은 주소를 안다
// (src/server/files.ts boundToLoopback). 전에는 스크립트가 STARSHIP_BIND=127.0.0.1을 그대로 적어 두어
// `pnpm dev -H 0.0.0.0`으로 모든 주소에 띄워도 파일 보기가 열렸다. 그래서 뒤에 붙인 -H까지 보고 마지막 값을 넘긴다.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = ["dev", "-H", "127.0.0.1", "-p", "7790", ...process.argv.slice(2)];

/** next처럼 마지막 -H·--hostname 값 */
let host = "127.0.0.1";
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-H" || a === "--hostname") host = args[i + 1] ?? "";
  else if (a.startsWith("--hostname=")) host = a.slice("--hostname=".length);
}

const next = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const child = spawn(process.execPath, [next, ...args], {
  stdio: "inherit",
  env: { ...process.env, STARSHIP_BIND: host },
});
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
