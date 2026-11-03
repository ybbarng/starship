// 본부(프로토콜 서버)로 보내는 요청. 시간 제한과, 여러 탭이 같은 것을 동시에 물을 때 한 번만 보내는 일을 맡는다.

/** 읽기 요청 시간 제한. 본부가 멈춰도 화면이 오래 매달리지 않게. */
export const READ_TIMEOUT_MS = 4_000;
/** 동작(답하기 등) 시간 제한. 본부가 세션에 넘기는 시간이 있어 더 길게 둔다. */
export const ACTION_TIMEOUT_MS = 10_000;

/** 캐시 없이, 시간 제한을 걸어 본부에 묻는다. 시간을 넘기면 TimeoutError로 실패한다. */
export function fetchUpstream(
  url: string,
  init: RequestInit = {},
  timeoutMs = READ_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, {
    cache: "no-store",
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** 같은 열쇠의 결과를 잠깐 함께 쓰는 시간. 탭 여러 개가 몇 초마다 묻는 것을 본부 요청 한 번으로 줄인다. */
export const SHARE_MS = 1_500;

type Entry = { at: number; done: boolean; promise: Promise<unknown> };

/**
 * 진행 중인 요청을 함께 쓰고, 끝난 결과도 ttl 동안 다시 쓴다. 실패한 것은 남기지 않는다.
 * 결과 객체는 여러 호출이 함께 받으니 고치지 않는다.
 */
export function createShared(ttl = SHARE_MS, clock: () => number = Date.now) {
  const entries = new Map<string, Entry>();
  return {
    get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const now = clock();
      const hit = entries.get(key);
      if (hit && (!hit.done || now - hit.at < ttl))
        return hit.promise as Promise<T>;
      const promise = load();
      const entry: Entry = { at: now, done: false, promise };
      entries.set(key, entry);
      promise.then(
        // 끝난 때부터 ttl을 센다(오래 걸린 요청의 결과가 곧바로 낡지 않게)
        () => {
          entry.done = true;
          entry.at = clock();
        },
        () => {
          if (entries.get(key) === entry) entries.delete(key);
        },
      );
      return promise;
    },
    /** 동작을 보낸 뒤 부른다. 다음 읽기가 동작 전 결과를 다시 보이지 않게. */
    clear() {
      entries.clear();
    },
  };
}
