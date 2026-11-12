export const CHAIN = 11155111n;
export const PROXY = "0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4";
export const RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
  "https://sepolia.gateway.tenderly.co",
  "https://0xrpc.io/sep",
];
export const SELECTORS = {
  state: "0xc19d93fb",
  configuration: "0x6c70bee9",
  roundPage: "0xc8b9e08f",
};
export type Blow = {
  roundId: string;
  work: string;
  dataHash: string;
  workPerThousandBlocks: string;
  cumulativeWork: string;
};
export type CoreState = {
  frontier: bigint;
  cumulativeWork: bigint;
  grain: bigint;
  paused: boolean;
};
export type CertifiedPage = {
  after: string;
  through: string;
  certified: string;
  raw: string;
  blows: Blow[];
};
export const word = (n: bigint) => {
  if (n < 0n || n >= 2n ** 256n) throw new Error("Invalid uint");
  return n.toString(16).padStart(64, "0");
};
function words(raw: string): string[] {
  if (!/^0x(?:[0-9a-fA-F]{64})+$/.test(raw))
    throw new Error("Malformed SqueekCore response");
  return raw.slice(2).match(/.{64}/g)!;
}
export function decodeState(raw: string): CoreState {
  const w = words(raw);
  if (w.length !== 8 || !["0".repeat(64), word(1n)].includes(w[7]))
    throw new Error("Invalid CoreState");
  return {
    frontier: BigInt("0x" + w[0]),
    cumulativeWork: BigInt("0x" + w[1]),
    grain: BigInt("0x" + w[5]),
    paused: BigInt("0x" + w[7]) === 1n,
  };
}
export function validateConfiguration(raw: string) {
  const w = words(raw);
  if (
    w.length !== 11 ||
    BigInt("0x" + w[2]) !== 600n ||
    BigInt("0x" + w[3]) !== 10000n ||
    BigInt("0x" + w[8]) !== 40n
  )
    throw new Error(
      "SqueekCore configuration changed; this bench needs a reviewed update.",
    );
}
export function decodePage(
  raw: string,
  after: bigint,
  through: bigint,
): CertifiedPage {
  if (after < 0n || through <= after) throw new Error("Invalid certified span");
  const w = words(raw);
  const n = (i: number) => {
    if (!w[i]) throw new Error("Truncated roundPage");
    return BigInt("0x" + w[i]);
  };
  if (n(0) !== 32n || n(8) !== 256n)
    throw new Error("Unexpected roundPage ABI");
  const certified = n(1),
    count = n(9);
  if (
    certified <= after ||
    certified > through ||
    count > 16n ||
    w.length !== 10 + Number(count) * 5
  )
    throw new Error("Invalid roundPage certification");
  let previousWork = n(2),
    previousId = after;
  const blows: Blow[] = [];
  for (let i = 0; i < Number(count); i++) {
    const k = 10 + i * 5,
      id = n(k),
      cumulativeWork = n(k + 1),
      work = cumulativeWork - previousWork,
      grain = n(k + 3),
      dataHash = "0x" + w[k + 4].toLowerCase();
    if (
      id <= previousId ||
      id > certified ||
      work <= 0n ||
      work > 10000n ||
      grain <= 0n ||
      /^0x0{64}$/.test(dataHash)
    )
      throw new Error("Invalid official active checkpoint");
    blows.push({
      roundId: id.toString(),
      work: work.toString(),
      cumulativeWork: cumulativeWork.toString(),
      workPerThousandBlocks: grain.toString(),
      dataHash,
    });
    previousWork = cumulativeWork;
    previousId = id;
  }
  if (n(5) !== previousWork)
    throw new Error("Checkpoint endpoint disagrees with official work");
  return {
    after: after.toString(),
    through: through.toString(),
    certified: certified.toString(),
    raw,
    blows,
  };
}
export type RPCRequest = (method: string, params: unknown[]) => Promise<string>;
export class CoreReader {
  private custom = "";
  private pages = new Map<string, CertifiedPage>();
  endpoint = RPCS[0];
  constructor(
    private storage?: Pick<Storage, "getItem" | "setItem">,
    public requestOverride?: RPCRequest,
  ) {}
  setCustom(url: string) {
    if (url) {
      const u = new URL(url);
      if (u.protocol !== "https:" || u.username || u.password || u.hash)
        throw new Error(
          "Use an HTTPS Sepolia RPC URL without credentials or a fragment.",
        );
    }
    this.custom = url;
  }
  async request(method: string, params: unknown[]): Promise<string> {
    if (this.requestOverride) return this.requestOverride(method, params);
    for (const endpoint of [...RPCS, ...(this.custom ? [this.custom] : [])]) {
      try {
        const send = async (m: string, p: unknown[]) => {
          const r = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: m,
              params: p,
            }),
            signal: AbortSignal.timeout(4500),
            credentials: "omit",
            redirect: "error",
          });
          if (!r.ok) throw new Error("RPC unavailable");
          const body = await r.json();
          if (body.error || typeof body.result !== "string")
            throw new Error("RPC rejected read");
          return body.result as string;
        };
        if (BigInt(await send("eth_chainId", [])) !== CHAIN) continue;
        const result = await send(method, params);
        this.endpoint = endpoint;
        return result;
      } catch {
        /* try the next public Sepolia provider, then the visitor's setting */
      }
    }
    throw new Error(
      "Sepolia reads are unavailable. Retry or set a Sepolia RPC in Bench notes.",
    );
  }
  call(data: string) {
    return this.request("eth_call", [{ to: PROXY, data }, "latest"]);
  }
  async state() {
    return decodeState(await this.call(SELECTORS.state));
  }
  async configuration() {
    validateConfiguration(await this.call(SELECTORS.configuration));
  }
  seed(pages: CertifiedPage[]) {
    for (const p of pages) {
      const decoded = decodePage(p.raw, BigInt(p.after), BigInt(p.through));
      this.pages.set(`${p.after}:${p.through}`, decoded);
    }
  }
  async page(after: bigint, through: bigint, frontier: bigint) {
    if (through > frontier)
      throw new Error("Cannot read past the settled frontier");
    const key = `${after}:${through}`;
    if (this.pages.has(key)) return this.pages.get(key)!;
    try {
      const raw = this.storage?.getItem(`wheelwright:r7:${CHAIN}:${PROXY}:${key}`);
      if (raw) {
        const p = decodePage(raw, after, through);
        this.pages.set(key, p);
        return p;
      }
    } catch {
      /* restricted storage or invalid cache: read the contract */
    }
    const p = decodePage(
      await this.call(
        SELECTORS.roundPage + word(after) + word(through) + word(16n),
      ),
      after,
      through,
    );
    this.pages.set(key, p);
    try {
      this.storage?.setItem(`wheelwright:r7:${CHAIN}:${PROXY}:${key}`, p.raw);
    } catch {
      /* optional cache */
    }
    return p;
  }
  async span(after: bigint, through: bigint, frontier: bigint) {
    const pages: CertifiedPage[] = [],
      blows: Blow[] = [];
    if (through > frontier)
      throw new Error("Unknown rounds beyond the frontier");
    let cursor = after;
    while (cursor < through) {
      const p = await this.page(cursor, through, frontier);
      pages.push(p);
      blows.push(...p.blows);
      if (BigInt(p.certified) >= through) break;
      // Exclusive cursor: use the last listed id, or certifiedThroughRound for an empty page.
      const next = p.blows.length
        ? BigInt(p.blows.at(-1)!.roundId)
        : BigInt(p.certified);
      if (next <= cursor) throw new Error("Certification made no progress");
      cursor = next;
    }
    return { blows, pages, after, through };
  }
  async historical(frontier: bigint) {
    const after = frontier > 144n ? frontier - 144n : 0n;
    const span = await this.span(after, frontier, frontier);
    return { ...span, newest: span.blows.slice(-8) };
  }
  async resolve(ids: string[], frontier: bigint): Promise<Blow[]> {
    const result: Blow[] = [];
    for (const id of ids) {
      const n = BigInt(id);
      if (n > frontier || n < 1n)
        throw new Error(`Round ${id} is beyond the certified frontier.`);
      const p = await this.page(n - 1n, n, frontier),
        b = p.blows.find((b) => b.roundId === id);
      if (!b)
        throw new Error(
          `Round ${id} is a certified rest, not an official blow.`,
        );
      result.push(b);
    }
    return result;
  }
}
export type SharedPiece = { mode: "historical" | "live"; ids: string[] };
export function parseShare(hash: string): SharedPiece | null {
  if (!hash) return null;
  const prefix = `#piece=v1,${CHAIN},${PROXY},`;
  if (!hash.startsWith(prefix) || hash.length > 90000)
    throw new Error(
      "Invalid piece link. Use a Wheelwright v1 link for the pinned Sepolia core.",
    );
  const [mode, ...ids] = hash.slice(prefix.length).split(",");
  if (
    !["historical", "live"].includes(mode) ||
    !ids.length ||
    ids.length > 4096 ||
    ids.some(
      (id) => !/^[1-9][0-9]{0,19}$/.test(id) || BigInt(id) > 2n ** 64n - 1n,
    ) ||
    ids.some((id, i) => i > 0 && BigInt(id) <= BigInt(ids[i - 1]))
  )
    throw new Error(
      "Invalid piece link: official round IDs must be positive and strictly increasing.",
    );
  return { mode: mode as SharedPiece["mode"], ids };
}
export const shareHash = (mode: SharedPiece["mode"], blows: Blow[]) => {
  const h = `#piece=v1,${CHAIN},${PROXY},${mode},${blows.map((b) => b.roundId).join(",")}`;
  parseShare(h);
  return h;
};
export function stringify(value: unknown) {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}
