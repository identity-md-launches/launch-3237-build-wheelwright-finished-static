import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CoreReader,
  decodePage,
  decodeState,
  parseShare,
  PROXY,
  shareHash,
  SELECTORS,
  word,
} from "../src/protocol";
import { PublicApi, parseStatus, disagrees } from "../src/api";
const seed = JSON.parse(readFileSync("public/certified-history.json", "utf8"));
test("actual certified page derives 1212 work from same-call start and official checkpoint", () => {
  const p = seed.check1212[0],
    decoded = decodePage(p.raw, 1211n, 1212n);
  assert.equal(decoded.blows[0].work, "80");
  assert.equal(decoded.blows[0].workPerThousandBlocks, "9769");
});
test("complete 144-round historical span paginates exclusively, selects 8 active rounds with gaps", async () => {
  const calls: string[] = [];
  const reader = new CoreReader(undefined, async (_m, params) => {
    const data = (params[0] as { data: string }).data;
    calls.push(data);
    const p = seed.pages.find(
      (p: { after: string; through: string }) =>
        data ===
        SELECTORS.roundPage +
          word(BigInt(p.after)) +
          word(BigInt(p.through)) +
          word(16n),
    );
    assert.ok(p, `Unexpected call ${data}`);
    return p.raw;
  });
  const h = await reader.historical(1248n);
  assert.equal(calls.length, 2);
  assert.equal(h.blows.length, 23);
  assert.deepEqual(
    h.newest.map((b) => b.roundId),
    ["1198", "1199", "1200", "1201", "1209", "1210", "1211", "1212"],
  );
  assert.equal(
    h.newest.reduce((sum, b) => sum + BigInt(b.work), 0n),
    2891n,
  );
  await reader.historical(1248n);
  assert.equal(calls.length, 2, "certified pages are cached");
});
test("never calls roundPage beyond settled frontier or resolves a rest as a blow", async () => {
  let calls = 0;
  const r = new CoreReader(undefined, async () => {
    calls++;
    throw new Error("network");
  });
  await assert.rejects(r.page(1247n, 1249n, 1248n));
  assert.equal(calls, 0);
  const empty =
    "0x" +
    [
      word(32n),
      word(1213n),
      word(63713n),
      word(0n),
      word(9769n),
      word(63713n),
      word(0n),
      word(9769n),
      word(256n),
      word(0n),
    ].join("");
  r.seed([{ ...decodePage(empty, 1212n, 1213n) }]);
  await assert.rejects(r.resolve(["1213"], 1248n), /rest/);
});
test("empty partial certification continues at certifiedThroughRound", async () => {
  const raw = (cert: bigint) =>
    "0x" + [32n, cert, 0n, 0n, 1n, 0n, 0n, 1n, 256n, 0n].map(word).join("");
  const calls: bigint[] = [];
  const r = new CoreReader(undefined, async (_m, p) => {
    const d = (p[0] as { data: string }).data;
    const after = BigInt("0x" + d.slice(10, 74));
    calls.push(after);
    return raw(after === 0n ? 5n : 10n);
  });
  await r.span(0n, 10n, 10n);
  assert.deepEqual(calls, [0n, 5n]);
});
test("only canonical exact v1 hashes, lowercase proxy and increasing positive uint64 ids", () => {
  const h = `#piece=v1,11155111,${PROXY},historical,1212`;
  assert.deepEqual(parseShare(h), { mode: "historical", ids: ["1212"] });
  for (const invalid of [
    "#anything",
    "javascript:alert(1)",
    h.replace("11155111", "1"),
    h.replace(PROXY, PROXY.toUpperCase()),
    h.replace("historical", "projected"),
    h + ",1212",
    h + ",1211",
    h.replace("1212", "0"),
    h.replace("1212", "01212"),
    h.replace("1212", "18446744073709551616"),
    h + ",",
    h + "\n",
  ])
    assert.throws(() => parseShare(invalid));
  assert.equal(shareHash("historical", seed.check1212[0].blows), h);
});
test("status never converts unavailable, stale, ACTIVE, null, wrong identity or unknown to IDLE/SPINNING", () => {
  const now = Date.now();
  const raw = {
    schemaVersion: 1,
    measurement: {
      freshness: "online",
      coreStatus: "SPINNING",
      receivedAt: new Date(now).toISOString(),
      staleAfterSeconds: 120,
    },
  };
  assert.equal(parseStatus(raw, true, now).lamp, "spinning");
  assert.equal(
    parseStatus(
      { ...raw, measurement: { ...raw.measurement, coreStatus: "IDLE" } },
      true,
      now,
    ).lamp,
    "idle",
  );
  for (const r of [
    { ...raw, status: "unavailable" },
    { ...raw, measurement: null },
    { ...raw, measurement: { ...raw.measurement, coreStatus: "ACTIVE" } },
    { ...raw, measurement: { ...raw.measurement, freshness: "unavailable" } },
    {
      ...raw,
      measurement: {
        ...raw.measurement,
        receivedAt: new Date(now - 121000).toISOString(),
      },
    },
  ])
    assert.equal(parseStatus(r, true, now).lamp, "unknown");
  assert.equal(parseStatus(raw, false, now).lamp, "unknown");
});
test("API ETag, 304 and Retry-After are honored; unavailable is an error", async () => {
  let n = 0;
  const bodies = [
    new Response(JSON.stringify({ status: "available", value: 7 }), {
      headers: { ETag: '"official"' },
    }),
    new Response(null, { status: 304 }),
    new Response("{}", { status: 429, headers: { "Retry-After": "60" } }),
  ];
  const api = new PublicApi((async (_u, init) => {
    if (n === 1)
      assert.equal(
        (init?.headers as Record<string, string>)["If-None-Match"],
        '"official"',
      );
    return bodies[n++];
  }) as typeof fetch);
  assert.equal((await api.get("/v1/core")).value, 7);
  assert.equal((await api.get("/v1/core")).value, 7);
  await assert.rejects(api.get("/v1/core"));
  await assert.rejects(api.get("/v1/core"), /retry later/);
  assert.equal(n, 3);
  const down = new PublicApi(
    (async () => new Response('{"status":"unavailable"}')) as typeof fetch,
  );
  await assert.rejects(down.get("/v1/core"));
});
test("published API core object and identity are parsed; contract disagreement is explicit", async () => {
  const core = decodeState(seed.rawState),
    raw = {
      schemaVersion: 1,
      status: "available",
      identities: { core: PROXY },
      core: {
        settledThroughRound: core.frontier.toString(),
        cumulativeWork: core.cumulativeWork.toString(),
        workPerThousandBlocks: core.grain.toString(),
        paused: false,
      },
    };
  const api = new PublicApi(
      (async () => new Response(JSON.stringify(raw))) as typeof fetch,
    ),
    a = await api.core();
  assert.equal(a.identity, true);
  assert.equal(disagrees(a, core), false);
  assert.equal(disagrees(a, { ...core, frontier: core.frontier + 1n }), true);
});
