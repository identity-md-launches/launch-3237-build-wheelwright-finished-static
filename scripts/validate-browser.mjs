// Bounded production-export validation. Fixtures are actual captured official checkpoints.
import { chromium, webkit } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const seed = JSON.parse(
  await readFile("public/certified-history.json", "utf8"),
);
const rounds = seed.pages.flatMap((p) => p.blows),
  frozen = seed.check1212[0].blows[0];
const word = (n) => BigInt(n).toString(16).padStart(64, "0");
function stateRaw(frontier = 1248n, paused = false) {
  const w = seed.rawState.slice(2).match(/.{64}/g);
  w[0] = word(frontier);
  w[7] = word(paused ? 1 : 0);
  return "0x" + w.join("");
}
function pageRaw(after, through) {
  const list = rounds
    .filter((b) => BigInt(b.roundId) > after && BigInt(b.roundId) <= through)
    .slice(0, 16);
  const prev = rounds.filter((b) => BigInt(b.roundId) <= after).at(-1);
  const start = prev?.cumulativeWork ?? "0",
    grain = prev?.workPerThousandBlocks ?? "1";
  const cert = list.length === 16 ? BigInt(list.at(-1).roundId) : through;
  const last = list.at(-1);
  return (
    "0x" +
    [
      32n,
      cert,
      start,
      0n,
      grain,
      last?.cumulativeWork ?? start,
      0n,
      last?.workPerThousandBlocks ?? grain,
      256n,
      BigInt(list.length),
    ]
      .map(word)
      .join("") +
    list
      .map((b) =>
        [
          word(b.roundId),
          word(b.cumulativeWork),
          word(0n),
          word(b.workPerThousandBlocks),
          b.dataHash.slice(2),
        ].join(""),
      )
      .join("")
  );
}
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    if (!u.pathname.startsWith("/preview/")) throw Error();
    const rel = decodeURIComponent(u.pathname.slice(9)) || "index.html";
    if (rel.includes("..")) throw Error();
    const file = path.join("dist", rel),
      bytes = await readFile(file);
    const ext = path.extname(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ttf": "font/ttf",
      }[ext] ?? "application/octet-stream",
    );
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
await mkdir("test/scratch/interactions", { recursive: true });
// Optional: CHROMIUM_PATH points at a locally installed Chromium build.
const chromiumPath = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : {};
const report = { engines: [], results: [], limitations: [] };
async function fixtures(context, options = {}) {
  const mode = {
    frontier: 1248n,
    lamp: "IDLE",
    paused: false,
    down: false,
    rpcDown: false,
    stateDelay: 0,
    seedFrontier: null,
    disagree: false,
    ...options,
  };
  await context.route(
    /https:\/\/(ethereum-sepolia-rpc\.publicnode\.com|1rpc\.io|sepolia\.gateway\.tenderly\.co|0xrpc\.io)/,
    async (route) => {
      if (mode.down || mode.rpcDown) return route.abort();
      const req = route.request().postDataJSON();
      let result;
      if (req.method === "eth_chainId") result = "0xaa36a7";
      else if (req.method === "eth_call") {
        const d = req.params[0].data;
        if (d === "0xc19d93fb") {
          const frontier = mode.frontier,
            paused = mode.paused;
          if (mode.stateDelay)
            await new Promise((r) => setTimeout(r, mode.stateDelay));
          result = stateRaw(frontier, paused);
        } else if (d === "0x6c70bee9") result = seed.rawConfiguration;
        else if (d.startsWith("0xc8b9e08f")) {
          const after = BigInt("0x" + d.slice(10, 74)),
            through = BigInt("0x" + d.slice(74, 138));
          assert.ok(through <= mode.frontier, "read never exceeds frontier");
          result = pageRaw(after, through);
        } else throw Error("Unexpected contract function");
      } else throw Error("Unexpected RPC method");
      return route.fulfill({ json: { jsonrpc: "2.0", id: req.id, result } });
    },
  );
  await context.route(/certified-history\.json$/, async (route) => {
    if (mode.seedFrontier === null) return route.continue();
    // An older cached snapshot: same certified pages, earlier recorded frontier.
    return route.fulfill({
      json: { ...seed, rawState: stateRaw(mode.seedFrontier) },
    });
  });
  await context.route("https://api.squeekchain.com/**", async (route) => {
    const url = route.request().url();
    if (mode.down) return route.fulfill({ json: { status: "unavailable" } });
    if (url.endsWith("/v1/status"))
      return route.fulfill({
        headers: { ETag: '"fixture-status"' },
        json: {
          schemaVersion: 1,
          measurement: {
            freshness: mode.lamp === "unknown" ? "unavailable" : "online",
            coreStatus: mode.lamp,
            receivedAt: new Date().toISOString(),
            staleAfterSeconds: 120,
          },
        },
      });
    if (url.endsWith("/v1/core"))
      return route.fulfill({
        json: {
          schemaVersion: 1,
          status: "available",
          identities: { core: seed.proxy },
          core: {
            settledThroughRound: String(
              mode.disagree ? mode.frontier - 1n : mode.frontier,
            ),
            cumulativeWork: "63713",
            workPerThousandBlocks: "9769",
            paused: mode.paused,
          },
        },
      });
    if (url.includes("/v1/settlements?range=24h"))
      return route.fulfill({
        json: { schemaVersion: 3, status: "unavailable", range: "24h" },
      });
    throw Error("Unexpected API call");
  });
  return mode;
}
try {
  for (const [name, engine] of process.argv.includes("--live-only")
    ? []
    : [
        ["Chromium", chromium],
        ["WebKit", webkit],
      ]) {
    let browser;
    try {
      browser = await engine.launch({
        headless: true,
        ...(name === "Chromium" ? chromiumPath : {}),
      });
    } catch (e) {
      report.limitations.push(
        `${name} could not launch: ${String(e).split("\n")[0]}`,
      );
      continue;
    }
    report.engines.push(name);
    console.log(name + ": started");
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    if (name === "Chromium")
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await fixtures(context);
    const p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p
      .getByRole("button", { name: "Forge historical piece", exact: true })
      .waitFor();
    assert.equal(await p.locator("h1").textContent(), "Wheelwright");
    const box = await p
      .getByRole("button", { name: "Forge historical piece", exact: true })
      .boundingBox();
    assert.ok(box.y + box.height < 844, "primary action on first phone screen");
    await p.screenshot({
      path: `test/scratch/interactions/${name.toLowerCase()}-390.png`,
    });
    // Keyboard focus travels to an action and the whole primary flow uses native buttons.
    await p
      .getByRole("button", { name: "Forge historical piece", exact: true })
      .focus();
    await p.screenshot({
      path: `test/scratch/interactions/${name.toLowerCase()}-focus.png`,
    });
    await p.keyboard.press("Enter");
    const shapes = [];
    for (const id of [
      "1198",
      "1199",
      "1200",
      "1201",
      "1209",
      "1210",
      "1211",
      "1212",
    ]) {
      const b = p.getByRole("button", {
        name: `Strike round ${id}`,
        exact: true,
      });
      await b.waitFor();
      await b.focus();
      await p.keyboard.press("Enter");
      await p
        .locator(".heart-value")
        .filter({ hasText: /^[a-f0-9]{8}$/ })
        .waitFor();
      shapes.push(
        await p.locator(".metal-piece polygon").first().getAttribute("points"),
      );
    }
    assert.equal(
      new Set(shapes).size,
      8,
      "every blow visibly changes the metal",
    );
    await p
      .getByRole("button", { name: "Quench to shelf", exact: true })
      .click();
    await p.getByRole("dialog").waitFor();
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press("Tab");
      assert.equal(
        await p
          .locator(".piece-dialog")
          .evaluate((el) => el.contains(document.activeElement)),
        true,
      );
    }
    assert.match(
      await p.locator(".piece-dialog .trait-list").innerText(),
      /2891/,
    );
    assert.equal(await p.locator(".blow-record li").count(), 8);
    await p
      .getByRole("button", { name: "Recompute from SqueekCore", exact: true })
      .click();
    await p
      .locator(".recompute-result")
      .filter({ hasText: "Match: Mass 2891" })
      .waitFor();
    await p
      .getByRole("button", { name: "Copy piece link", exact: true })
      .click();
    if (name === "Chromium")
      assert.ok(
        (await p.evaluate(() => navigator.clipboard.readText())).endsWith(
          "#piece=v1,11155111," +
            seed.proxy +
            ",historical,1198,1199,1200,1201,1209,1210,1211,1212",
        ),
      );
    await p.locator(".piece-dialog").evaluate((el) => (el.scrollTop = 0));
    await p.screenshot({
      path: `test/scratch/interactions/${name.toLowerCase()}-piece.png`,
    });
    await p.keyboard.press("Escape");
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await p
        .getByRole("button", { name: "Forge historical piece", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await p.locator(".shelf-piece").count(), 1);
    await p.reload();
    await p.locator(".shelf-piece").waitFor();
    await p.locator(".shelf-piece").click();
    await p.getByRole("dialog").waitFor();
    await p.getByRole("button", { name: "Close piece" }).click();
    console.log(name + ": shelf complete");
    // Shared 1212 reconstructs without the settlements endpoint.
    await p.goto(base + `#piece=v1,11155111,${seed.proxy},historical,1212`);
    await p.getByRole("dialog").waitFor();
    await p.locator("#piece-title").filter({ hasText: "deb98f44" }).waitFor();
    await p.screenshot({
      path: `test/scratch/interactions/${name.toLowerCase()}-1212.png`,
    });
    assert.match(
      await p.locator(".piece-dialog .trait-list").innerText(),
      /1 steered \/ 0 light/,
    );
    await p
      .getByRole("button", { name: "Recompute from SqueekCore", exact: true })
      .click();
    await p
      .locator(".recompute-result")
      .filter({ hasText: "Match: Mass 80, Heart deb98f44" })
      .waitFor();
    await p.getByRole("button", { name: "Close piece" }).click();
    await p.goto(base + "#piece=javascript:alert(1)");
    await p
      .getByRole("status")
      .filter({ hasText: "Invalid piece link" })
      .waitFor();
    assert.equal(await p.getByRole("dialog").isVisible(), false);
    console.log(name + ": share complete");
    assert.deepEqual(errors, []);
    report.results.push(
      `${name}: historical strike ×8, eight distinct metal shapes, quench, 8 records, recompute, shelf persistence, 1212 share, exact traits, malformed-hash rejection, keyboard and Escape passed.`,
    );
    for (const width of [320, 720, 1000, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p.goto(base);
      await p
        .getByRole("button", { name: "Forge historical piece", exact: true })
        .waitFor();
      assert.equal(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        ),
        false,
      );
    }
    report.results.push(
      `${name}: no horizontal overflow at 320, 390, 720, 1000, 1440.`,
    );
    await context.close();
    await browser.close();
  }
  console.log("Starting live transitions");
  // Live transitions use the genuine 1212 checkpoint, moving the test frontier from 1211 to 1212.
  const browser = await chromium.launch({ headless: true, ...chromiumPath }),
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    mode = await fixtures(ctx, { frontier: 1211n, lamp: "SPINNING" }),
    p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("Live page error:", e.message));

  await p.goto(base);
  await p
    .getByRole("button", { name: "Light live fire", exact: false })
    .waitFor();
  await p
    .getByRole("button", { name: "Light live fire", exact: false })
    .isEnabled();
  await p
    .waitForFunction(
      () => !document.querySelector(".secondary-actions button").disabled,
    )
    .catch(async (e) => {
      console.log(await p.locator("body").innerText());
      await p.screenshot({ path: "test/scratch/interactions/live-debug.png" });
      throw e;
    });
  await p
    .getByRole("button", { name: "Light live fire", exact: false })
    .click();
  await p.getByText("Awaiting an official blow", { exact: true }).waitFor();
  assert.equal(
    await p
      .getByRole("button", { name: "Awaiting an official blow" })
      .isDisabled(),
    true,
  );
  mode.frontier = 1212n;
  await p.getByRole("button", { name: "Refresh official data" }).click();
  await p.getByText("Latest #1212 · work 80", { exact: true }).waitFor();
  mode.lamp = "unknown";
  await p.getByRole("button", { name: "Refresh official data" }).click();
  await p.getByText("The fire is covered.", { exact: true }).waitFor();
  assert.equal(await p.locator(".piece-progress strong").innerText(), "1");
  await p.screenshot({
    path: "test/scratch/interactions/live-covered-390.png",
  });
  mode.lamp = "SPINNING";
  await p.getByRole("button", { name: "Refresh official data" }).click();
  await p.getByText("Every blow leaves a mark.", { exact: true }).waitFor();
  mode.paused = true;
  await p.getByRole("button", { name: "Refresh official data" }).click();
  await p.getByText("The fire is covered.", { exact: true }).waitFor();
  mode.paused = false;
  mode.lamp = "IDLE";
  await p.getByRole("button", { name: "Refresh official data" }).click();
  await p.getByText("The live fire has died.", { exact: true }).waitFor();
  await p.getByRole("button", { name: "Quench to shelf", exact: true }).click();
  await p.locator("#piece-title").filter({ hasText: "deb98f44" }).waitFor();
  assert.match(
    await p.locator(".provenance").innerText(),
    /Lit frontier: 1211/,
  );
  report.results.push(
    "Chromium: legal live lighting, zero-blow quench prevention, official 1212 auto strike, unknown cover, spinning resume, paused cover, IDLE death and as-is quench passed.",
  );
  await ctx.close();

  // Regression scenarios for the revision findings.
  const phaseText = (pg) => pg.locator(".secondary-actions .small").innerText();
  const blowsText = (pg) => pg.locator(".piece-progress strong").innerText();
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  {
    // Finding: a historical piece can be quenched after one official blow.
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await fixtures(c);
    const pg = await c.newPage();
    await pg.goto(base);
    await pg
      .getByRole("button", { name: "Forge historical piece", exact: true })
      .click();
    assert.equal(
      await pg
        .getByRole("button", { name: "Quench to shelf", exact: true })
        .count(),
      0,
      "zero-blow historical fire offers no quench",
    );
    await pg
      .getByRole("button", { name: "Strike round 1198", exact: true })
      .click();
    await pg
      .getByRole("button", { name: "Strike round 1199", exact: true })
      .waitFor();
    await pg
      .getByRole("button", { name: "Quench to shelf", exact: true })
      .click();
    await pg.locator("#piece-title").waitFor();
    const body = await pg.locator("dialog").innerText();
    assert.match(body, /1198/);
    assert.doesNotMatch(body, /1199/);
    await pg.screenshot({
      path: "test/scratch/interactions/one-blow-quench-390.png",
    });
    report.results.push(
      "Chromium: a historical fire quenches to the shelf after one official blow (round 1198) while Strike round 1199 stays available; zero blows offer no quench.",
    );
    await c.close();
  }
  {
    // Finding: rounds certified while covered never strike after the lamp returns.
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const m = await fixtures(c, { frontier: 1211n, lamp: "SPINNING" });
    const pg = await c.newPage();
    await pg.goto(base);
    await pg.waitForFunction(
      () => !document.querySelector(".secondary-actions button").disabled,
    );
    await pg
      .getByRole("button", { name: "Light live fire", exact: false })
      .click();
    await pg.getByText("Awaiting an official blow", { exact: true }).waitFor();
    m.lamp = "unknown";
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pg.getByText("The fire is covered.", { exact: true }).waitFor();
    m.frontier = 1212n;
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pause(1500);
    assert.equal(await blowsText(pg), "0");
    m.lamp = "SPINNING";
    m.stateDelay = 2200;
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pause(1400);
    assert.equal(
      await phaseText(pg),
      "covered",
      "status alone does not resume",
    );
    await pg.waitForFunction(
      () =>
        document.querySelector(".secondary-actions .small")?.textContent ===
        "burning",
      null,
      { timeout: 15000 },
    );
    await pause(3000);
    assert.equal(await blowsText(pg), "0", "covered round 1212 never strikes");
    m.stateDelay = 0;
    report.results.push(
      "Chromium: a live fire covered by an unavailable lamp while 1212 was certified resumes only after a fresh state read, with 0 blows (1212 not awarded); a delayed state() keeps it covered.",
    );
    await c.close();
  }
  {
    // Finding: an RPC failure never resurrects a fire killed by IDLE.
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const m = await fixtures(c, { frontier: 1211n, lamp: "SPINNING" });
    const pg = await c.newPage();
    await pg.goto(base);
    await pg.waitForFunction(
      () => !document.querySelector(".secondary-actions button").disabled,
    );
    await pg
      .getByRole("button", { name: "Light live fire", exact: false })
      .click();
    await pg.getByText("Awaiting an official blow", { exact: true }).waitFor();
    m.lamp = "IDLE";
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pg.getByText("The live fire has died.", { exact: true }).waitFor();
    m.rpcDown = true;
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pause(2500);
    assert.equal(await phaseText(pg), "dead");
    m.rpcDown = false;
    m.lamp = "SPINNING";
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pause(2500);
    assert.equal(await phaseText(pg), "dead");
    m.frontier = 1212n;
    await pg.getByRole("button", { name: "Refresh official data" }).click();
    await pause(2500);
    assert.equal(await phaseText(pg), "dead");
    assert.equal(await blowsText(pg), "0");
    await pg.getByRole("button", { name: "Abandon fire", exact: true }).click();
    await pg
      .getByRole("button", { name: "Light live fire", exact: false })
      .waitFor();
    report.results.push(
      "Chromium: a fire killed by IDLE stays dead with 0 blows through an RPC failure, a spinning lamp and a new certified round 1212; only Abandon frees the bench for a new lighting.",
    );
    await c.close();
  }
  {
    // Finding: a valid shared piece opens once the current frontier arrives.
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await fixtures(c, {
      frontier: 1212n,
      seedFrontier: 1211n,
      stateDelay: 2200,
    });
    const pg = await c.newPage();
    await pg.goto(
      base + "#piece=v1,11155111," + seed.proxy + ",historical,1212",
    );
    await pg
      .locator("#piece-title")
      .filter({ hasText: "deb98f44" })
      .waitFor({ timeout: 15000 });
    assert.match(await pg.locator("dialog").innerText(), /80/);
    await c.close();
    const c2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const m2 = await fixtures(c2, { rpcDown: true });
    const pg2 = await c2.newPage();
    await pg2.goto(
      base + "#piece=v1,11155111," + seed.proxy + ",historical,1198",
    );
    await pg2
      .getByRole("button", { name: "Forge historical piece", exact: true })
      .waitFor();
    await pause(2500);
    assert.equal(await pg2.locator("#piece-title").isVisible(), false);
    m2.rpcDown = false;
    await pg2.getByRole("button", { name: "Refresh official data" }).click();
    await pg2
      .locator("#piece-title")
      .filter({ hasText: "ab8a1708" })
      .waitFor({ timeout: 15000 });
    report.results.push(
      "Chromium: a shared historical,1212 link opens (Heart deb98f44) after a delayed current state() overtakes a cached 1211 frontier; a historical,1198 link opened during an RPC outage opens (Heart ab8a1708) after Refresh official data, without reload or /v1/settlements.",
    );
    await c2.close();
  }
  const failure = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await fixtures(failure, { down: true });
  const fp = await failure.newPage();
  await fp.goto(base);
  await fp
    .getByRole("button", { name: "Forge historical piece", exact: true })
    .waitFor();
  await fp.locator(".lamp").filter({ hasText: "Wheel unknown" }).waitFor();
  assert.equal(
    await fp
      .getByRole("button", { name: "Light live fire", exact: false })
      .isDisabled(),
    true,
  );
  await fp
    .getByRole("button", { name: "Forge historical piece", exact: true })
    .click();
  await fp
    .getByRole("button", { name: "Strike round 1198", exact: true })
    .click();
  await fp
    .locator(".heart-value")
    .filter({ hasText: /^[a-f0-9]{8}$/ })
    .waitFor();
  report.results.push(
    "Chromium: simultaneous API/RPC failure keeps unknown lamp, disables live lighting and permits cached official historical play.",
  );
  await failure.close();
  await browser.close();
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await writeFile(
    "test/scratch/interactions/results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
