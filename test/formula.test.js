import test from "node:test";
import assert from "node:assert/strict";
import { traits } from "../src/formula.js";
const frozen = {
  roundId: "1212",
  work: "80",
  dataHash:
    "0xf92e09fa2841de7ce610da44324b09a22acfef747dc89875ea1d6b4852b167a9",
  workPerThousandBlocks: "9769",
  cumulativeWork: "63713",
};
test("official 1212: Mass 80, 1 steered / 0 light, SHA-256 Heart deb98f44, Grain 9769", async () => {
  assert.deepEqual(await traits([frozen]), {
    mass: "80",
    temper: "1 steered / 0 light",
    heart: "deb98f44",
    grain: "9769",
    steered: "1",
    light: "0",
  });
});
test("Heart normalizes hash case and has no trailing newline", async () => {
  assert.equal(
    (
      await traits([
        {
          ...frozen,
          dataHash: frozen.dataHash.toUpperCase().replace("0X", "0x"),
        },
      ])
    ).heart,
    "deb98f44",
  );
  const text = `1212:${frozen.dataHash}\n`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  assert.notEqual(Buffer.from(digest).toString("hex").slice(0, 8), "deb98f44");
});
test("reject rests, missing hashes, unsorted and duplicate rounds", async () => {
  for (const blows of [
    [],
    [{ ...frozen, work: "0" }],
    [{ ...frozen, dataHash: "0x" + "0".repeat(64) }],
    [frozen, frozen],
    [frozen, { ...frozen, roundId: "1211" }],
  ])
    await assert.rejects(traits(blows));
});
test("steering boundary and last official difficulty are authoritative", async () => {
  const result = await traits([
    { ...frozen, roundId: "1210", work: "39", workPerThousandBlocks: "1" },
    { ...frozen, roundId: "1211", work: "40", workPerThousandBlocks: "2" },
    frozen,
  ]);
  assert.equal(result.mass, "159");
  assert.equal(result.temper, "2 steered / 1 light");
  assert.equal(result.grain, "9769");
});
