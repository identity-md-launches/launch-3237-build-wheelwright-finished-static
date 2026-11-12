import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptLive,
  livePhase,
  mayBurn,
  restRanges,
  resumeLive,
  type Fire,
} from "../src/game";
import type { Status } from "../src/api";
import { readFileSync } from "node:fs";
const official = JSON.parse(
  readFileSync("public/certified-history.json", "utf8"),
).check1212[0].blows;
const core = {
  frontier: 1212n,
  cumulativeWork: 63713n,
  grain: 9769n,
  paused: false,
};
const st = (lamp: Status["lamp"]): Status => ({
  lamp,
  checkedAt: Date.now(),
  reason: "test only",
});
const fire = (): Fire => ({
  mode: "live",
  blows: [],
  available: [],
  litFrontier: "1211",
  scannedFrontier: "1211",
  phase: "burning",
  rests: [],
});
test("live lighting requires all three legal gates and a recent status read", () => {
  assert.equal(mayBurn(st("spinning"), core), true);
  for (const lamp of ["unknown", "idle"] as const)
    assert.equal(mayBurn(st(lamp), core), false);
  assert.equal(mayBurn(st("spinning"), { ...core, paused: true }), false);
  assert.equal(mayBurn(st("spinning"), null), false);
  assert.equal(
    mayBurn({ ...st("spinning"), checkedAt: Date.now() - 9000 }, core),
    false,
  );
});
test("unknown or paused covers, idle dies; dead cannot relight", () => {
  assert.equal(livePhase(fire(), st("unknown"), core), "covered");
  assert.equal(
    livePhase(fire(), st("spinning"), { ...core, paused: true }),
    "covered",
  );
  assert.equal(livePhase(fire(), st("idle"), core), "dead");
  assert.equal(
    livePhase({ ...fire(), phase: "dead" }, st("spinning"), core),
    "dead",
  );
  assert.equal(
    livePhase({ ...fire(), mode: "historical" }, st("unknown"), null),
    "burning",
  );
});
test("only certified ordered rounds after lighting are accepted while burning", () => {
  const f = fire(),
    n = acceptLive(f, official, 1212n, st("spinning"), core);
  assert.equal(n.available.length, 1);
  assert.equal(n.scannedFrontier, "1212");
  assert.equal(n.available[0].work, "80");
  assert.equal(acceptLive(f, official, 1212n, st("unknown"), core), f);
  assert.equal(
    acceptLive(
      { ...f, phase: "covered" },
      official,
      1212n,
      st("spinning"),
      core,
    ).available.length,
    0,
  );
  assert.throws(() =>
    acceptLive(
      { ...f, scannedFrontier: "1212" },
      official,
      1213n,
      st("spinning"),
      { ...core, frontier: 1213n },
    ),
  );
});
test("cover gaps never become retroactive live blows and existing blows are preserved", () => {
  const f = {
    ...fire(),
    phase: "covered" as const,
    blows: official,
    available: official,
  };
  const n = resumeLive(f, st("spinning"), { ...core, frontier: 1248n });
  assert.equal(n.scannedFrontier, "1248");
  assert.equal(n.blows.length, 1);
  assert.equal(n.litFrontier, "1211");
});
test("omitted rounds in a certified span are zero-work rests, including tail rests", () => {
  assert.deepEqual(restRanges(1209n, 1214n, official), [
    ["1210", "1211"],
    ["1213", "1214"],
  ]);
  assert.deepEqual(restRanges(1212n, 1248n, []), [["1213", "1248"]]);
});
