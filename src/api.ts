import { PROXY, type CoreState } from "./protocol";
export type Lamp = "unknown" | "idle" | "spinning";
export type Status = {
  lamp: Lamp;
  receivedAt?: string;
  checkedAt: number;
  reason: string;
  raw?: unknown;
};
export type ApiCore = {
  identity: boolean;
  state?: { frontier: bigint; work: bigint; grain: bigint; paused: boolean };
  raw: unknown;
};
type Json = Record<string, any>;
export class PublicApi {
  private cache = new Map<string, { etag: string; body: Json }>();
  private retry = new Map<string, number>();
  private last = new Map<string, number>();
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  async get(path: string, refresh = false): Promise<Json> {
    const now = Date.now();
    if (now < (this.retry.get(path) ?? 0))
      throw new Error("API asked to retry later.");
    if (
      path.includes("settlements") &&
      !refresh &&
      now - (this.last.get(path) ?? 0) < 60000
    ) {
      const old = this.cache.get(path);
      if (old) return old.body;
      throw new Error("Settlement reads are spaced one minute apart.");
    }
    this.last.set(path, now);
    const old = this.cache.get(path);
    const r = await this.fetcher("https://api.squeekchain.com" + path, {
      credentials: "omit",
      redirect: "error",
      headers: old?.etag ? { "If-None-Match": old.etag } : {},
      signal: AbortSignal.timeout(5500),
    });
    const delay = r.headers.get("Retry-After");
    if (delay) {
      const ms = /^\d+$/.test(delay)
        ? Number(delay) * 1000
        : Date.parse(delay) - now;
      if (ms > 0) this.retry.set(path, now + ms);
    }
    if (r.status === 304 && old) return old.body;
    if (!r.ok) throw new Error("Public API unavailable");
    const body = await r.json();
    if (!body || typeof body !== "object" || body.status === "unavailable") {
      this.cache.delete(path);
      throw new Error("Public API data is unknown");
    }
    const etag = r.headers.get("ETag");
    if (etag) this.cache.set(path, { etag, body });
    return body;
  }
  async status(identity: boolean): Promise<Status> {
    try {
      return parseStatus(await this.get("/v1/status"), identity);
    } catch {
      return {
        lamp: "unknown",
        checkedAt: Date.now(),
        reason: "Live API unavailable. Historical blows are ready.",
      };
    }
  }
  async core(): Promise<ApiCore> {
    const raw = await this.get("/v1/core");
    const core = raw.identities?.core;
    const identity = typeof core === "string" && core.toLowerCase() === PROXY;
    const s = raw.core;
    if (
      !identity ||
      raw.schemaVersion !== 1 ||
      raw.status !== "available" ||
      !s ||
      typeof s.paused !== "boolean"
    )
      return { identity: false, raw };
    const decimal = (v: unknown) => {
      if (typeof v !== "string" || !/^\d+$/.test(v))
        throw new Error("Malformed API core state");
      return BigInt(v);
    };
    return {
      identity,
      raw,
      state: {
        frontier: decimal(s.settledThroughRound),
        work: decimal(s.cumulativeWork),
        grain: decimal(s.workPerThousandBlocks),
        paused: s.paused,
      },
    };
  }
  async settlements(refresh = false): Promise<string[]> {
    const r = await this.get("/v1/settlements?range=24h", refresh);
    if (
      r.schemaVersion !== 3 ||
      r.status !== "available" ||
      r.range !== "24h" ||
      !Array.isArray(r.recentSettlements) ||
      r.recentSettlements.length > 10
    )
      throw new Error("Settlement list is unknown");
    return r.recentSettlements.flatMap((s: Json) =>
      typeof s.transactionHash === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(s.transactionHash) &&
      !/^0x0{64}$/i.test(s.transactionHash) &&
      BigInt(s.completedBlockCount ?? "0") > 0n
        ? [s.transactionHash.toLowerCase()]
        : [],
    );
  }
}
export function parseStatus(
  raw: Json,
  identity: boolean,
  now = Date.now(),
): Status {
  const m = raw.measurement;
  const received = Date.parse(m?.receivedAt),
    age = now - received;
  // A 304 never makes an old device measurement fresh again.
  const fresh =
    identity &&
    raw.schemaVersion === 1 &&
    raw.status !== "unavailable" &&
    m?.freshness === "online" &&
    Number.isFinite(age) &&
    age >= -5000 &&
    age <= Math.min(120, Number(m.staleAfterSeconds ?? 120)) * 1000;
  const lamp: Lamp =
    fresh && m.coreStatus === "SPINNING"
      ? "spinning"
      : fresh && m.coreStatus === "IDLE"
        ? "idle"
        : "unknown";
  return {
    lamp,
    receivedAt: m?.receivedAt,
    checkedAt: now,
    reason:
      lamp === "spinning"
        ? "Official wheel spinning"
        : lamp === "idle"
          ? "Official wheel idle"
          : "Live wheel status unknown",
    raw,
  };
}
export function disagrees(api: ApiCore | null, state: CoreState): boolean {
  if (!api) return false;
  if (!api.identity) return true;
  const a = api.state;
  return (
    !!a &&
    (a.frontier !== state.frontier ||
      a.work !== state.cumulativeWork ||
      a.grain !== state.grain ||
      a.paused !== state.paused)
  );
}
