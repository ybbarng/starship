"use client";

// md 파일을 읽기 좋게 그려 보여 준다(2026-11-03). 설계: docs/files.md "md 보기 화면".
// 내용은 브라우저에서 /api/files로 받는다(허용 폴더·숨김·출처 검사는 그 끝점이 한다).
// 보안: md 속 HTML은 그리지 않는다(rehype-raw를 쓰지 않아 글자로만 나온다).
// 위험한 주소(javascript: 등)는 react-markdown 기본 urlTransform이 빈 값으로 바꾼다.
// 그림은 불러오지 않고 대체 글로 둔다: 로컬 경로 그림이 /api/files 검사를 우회하지 않고, 바깥 주소로 요청도 나가지 않게.
// 상대 경로 링크는 지금 파일의 폴더 기준으로 풀어 같은 탭에서 연다(md는 이 화면, 그 밖은 /api/files). 검사는 서버가 한다.
// 제목에는 GitHub식 id를 붙여 `#절` 링크가 그 제목으로 간다.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useOpenFile } from "@/ui/kit/FileButtons";
import { baseName, fileViewHref } from "@/ui/kit/filePaths";
import { Toasts } from "@/ui/kit/Toasts";
import { createSlugger, resolveMdLink } from "./mdLinks";
import { MAX_MD_RENDER_BYTES, mdTooBig, megabytes } from "./mdSize";

type Load =
  | { state: "loading" }
  | { state: "ok"; text: string }
  | { state: "big"; bytes: number }
  | { state: "error"; reason: string };

const WEB = /^(https?:|mailto:)/i;

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** hast 마디 중 여기서 보는 것만(타입 의존을 늘리지 않으려고 모양만 적는다) */
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const HEADING = /^h[1-6]$/;

const textOf = (n: HastNode): string =>
  n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(textOf).join("");

/**
 * 제목(h1~h6)에 GitHub식 id를 붙이는 작은 rehype 단계. 문서 순서대로 한 번 돈다.
 * heading 그리기 함수 안에서 세면 React가 두 번 그릴 때(StrictMode) 겹침 번호가 밀려서, 그리기 전에 나무에 적는다.
 */
function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const slug = createSlugger();
    const walk = (n: HastNode) => {
      if (n.type === "element" && n.tagName && HEADING.test(n.tagName))
        n.properties = { ...n.properties, id: slug(textOf(n)) };
      for (const c of n.children ?? []) walk(c);
    };
    walk(tree);
  };
}

const REHYPE = [rehypeHeadingIds];

function componentsFor(current: string): Components {
  return {
    a: ({ href, children }) => {
      if (href?.startsWith("#")) return <a href={href}>{children}</a>;
      if (href && WEB.test(href))
        return <ExternalLink href={href}>{children}</ExternalLink>;
      const to = href ? resolveMdLink(current, href) : null;
      if (to) {
        const hash = to.hash ? `#${encodeURIComponent(to.hash)}` : "";
        return (
          <a href={`${fileViewHref(to.path)}${hash}`} data-md-file-link>
            {children}
          </a>
        );
      }
      // 풀 수 없는 경로·막힌 주소는 링크로 두지 않는다
      return (
        <span data-md-nolink title={href || undefined}>
          {children}
        </span>
      );
    },
    img: ({ src, alt }) => {
      const s = typeof src === "string" ? src : "";
      const label = `그림${alt ? `: ${alt}` : ""}`;
      return /^https?:/i.test(s) ? (
        <ExternalLink href={s}>[{label} ↗]</ExternalLink>
      ) : (
        <span data-md-img title={s || undefined}>
          [{label}]
        </span>
      );
    },
  };
}

/** 주소의 #조각이 가리키는 제목으로 간다. 내용은 fetch한 뒤에 그려지니 브라우저가 처음에는 못 찾는다. */
function scrollToHash() {
  const raw = window.location.hash.slice(1);
  if (!raw) return;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {}
  document.getElementById(id)?.scrollIntoView();
}

export function MdView({ path }: { path: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [raw, setRaw] = useState(false);
  const { open, busy } = useOpenFile(path);
  const components = useMemo(() => componentsFor(path), [path]);
  const shown = load.state === "ok" && !raw;

  useEffect(() => {
    if (shown) scrollToHash();
  }, [shown]);

  useEffect(() => {
    if (!path) {
      setLoad({ state: "error", reason: "볼 파일 경로가 없어요" });
      return;
    }
    let alive = true;
    setLoad({ state: "loading" });
    fetch(`/api/files?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then(async (res) => {
        // 너무 큰 파일은 받지 않고 그만둔다(그리면 탭이 멈춘다)
        const big = res.ok ? mdTooBig(res.headers.get("content-length")) : null;
        if (big !== null) {
          await res.body?.cancel().catch(() => {});
          if (alive) setLoad({ state: "big", bytes: big });
          return;
        }
        const text = await res.text();
        if (!alive) return;
        setLoad(
          res.ok
            ? { state: "ok", text }
            : {
                state: "error",
                reason: text || `파일을 받지 못했어요(${res.status})`,
              },
        );
      })
      .catch(() => {
        if (alive) setLoad({ state: "error", reason: "서버에 닿지 못했어요" });
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <main className="min-h-screen bg-hull-950 px-4 pb-24 text-[#e8ecf6] sm:px-8">
      <header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-white/[0.08] bg-hull-950/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="mx-auto flex max-w-[72ch] flex-wrap items-center gap-x-3 gap-y-1">
          <h1
            data-md-name
            className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white"
          >
            {path ? baseName(path) : "파일 보기"}
          </h1>
          <button
            type="button"
            data-md-raw
            disabled={load.state !== "ok"}
            onClick={() => setRaw((v) => !v)}
            className="rounded bg-white/[0.08] px-2 py-1 text-[12px] text-white/80 hover:bg-white/[0.14] disabled:opacity-40"
          >
            {raw ? "그려 보기" : "날 글 보기"}
          </button>
          <button
            type="button"
            data-file-open
            disabled={!path || busy}
            onClick={open}
            title="맥에서 맞는 프로그램으로 열어요"
            className="rounded bg-white/[0.08] px-2 py-1 text-[12px] text-white/80 hover:bg-white/[0.14] disabled:opacity-40"
          >
            열기
          </button>
          {path && (
            <p
              data-md-path
              className="w-full font-mono text-[11px] break-all text-white/40"
            >
              {path}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[72ch]">
        {load.state === "loading" && (
          <p className="text-white/40">불러오는 중…</p>
        )}
        {load.state === "error" && (
          <p
            data-md-error
            className="rounded-md border border-signal-alert/40 bg-signal-alert/[0.06] px-3 py-2 text-[13px] text-[#ffb3b3]"
          >
            {load.reason}
          </p>
        )}
        {load.state === "big" && (
          <div
            data-md-big
            className="rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-3 text-[13px] text-white/80"
          >
            <p>
              {megabytes(load.bytes)}짜리라 여기서 그려 보이지 않아요(
              {megabytes(MAX_MD_RENDER_BYTES)}까지). 날 글로 보거나 맥에서 열어
              보세요.
            </p>
            <div className="mt-2 flex gap-2">
              <a
                data-md-raw-link
                href={`/api/files?path=${encodeURIComponent(path)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-white/[0.08] px-2 py-1 text-[12px] text-white/80 hover:bg-white/[0.14]"
              >
                날 글 보기
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={open}
                className="rounded bg-white/[0.08] px-2 py-1 text-[12px] text-white/80 hover:bg-white/[0.14] disabled:opacity-40"
              >
                열기
              </button>
            </div>
          </div>
        )}
        {load.state === "ok" &&
          (raw ? (
            <pre
              data-md-source
              className="font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-white/80"
            >
              {load.text}
            </pre>
          ) : (
            <article data-md-body className="md-body">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={REHYPE}
                components={components}
              >
                {load.text}
              </Markdown>
            </article>
          ))}
      </div>
      <Toasts />
    </main>
  );
}
