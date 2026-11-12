import type { Blow, CoreState } from "./protocol";
import type { Status } from "./api";
export type Fire = {
  mode: "historical" | "live";
  blows: Blow[];
  available: Blow[];
  litFrontier?: string;
  scannedFrontier?: string;
  endFrontier?: string;
  phase: "burning" | "covered" | "dead";
  rests: [string, string][];
  historyFrontier?: string;
};
export const mayBurn = (
  status: Status,
  core: CoreState | null,
  now = Date.now(),
) =>
  !!core &&
  !core.paused &&
  status.lamp === "spinning" &&
  now - status.checkedAt <= 8000;
export function livePhase(
  fire: Fire,
  status: Status,
  core: CoreState | null,
  now = Date.now(),
): Fire["phase"] {
  if (fire.mode === "historical") return "burning";
  if (fire.phase === "dead") return "dead";
  if (
    !core ||
    core.paused ||
    now - status.checkedAt > 8000 ||
    status.lamp === "unknown"
  )
    return "covered";
  return status.lamp === "idle" ? "dead" : "burning";
}
export function restRanges(
  after: bigint,
  through: bigint,
  blows: Blow[],
): [string, string][] {
  const ranges: [string, string][] = [];
  let start = after + 1n;
  for (const b of blows) {
    const id = BigInt(b.roundId);
    if (id > start) ranges.push([start.toString(), (id - 1n).toString()]);
    start = id + 1n;
  }
  if (start <= through) ranges.push([start.toString(), through.toString()]);
  return ranges;
}
/** Called only after one complete bounded roundPage span and a fresh, unchanged legal lamp. */
export function acceptLive(
  fire: Fire,
  blows: Blow[],
  through: bigint,
  status: Status,
  core: CoreState | null,
): Fire {
  if (
    fire.mode !== "live" ||
    fire.phase !== "burning" ||
    !mayBurn(status, core)
  )
    return fire;
  const after = BigInt(fire.scannedFrontier!);
  if (through <= after || through > core!.frontier) return fire;
  if (
    blows.some(
      (b, i) =>
        BigInt(b.roundId) <= after ||
        BigInt(b.roundId) > through ||
        (i > 0 && BigInt(b.roundId) <= BigInt(blows[i - 1].roundId)),
    )
  )
    throw new Error("Out of order live certification");
  return {
    ...fire,
    scannedFrontier: through.toString(),
    available: [...fire.available, ...blows],
    rests: [...fire.rests, ...restRanges(after, through, blows)],
  };
}
/** Cover gaps are deliberately skipped; they never become retroactive live blows. */
export function resumeLive(fire: Fire, status: Status, core: CoreState): Fire {
  const phase = livePhase(fire, status, core);
  if (fire.phase === "covered" && phase === "burning")
    return { ...fire, phase, scannedFrontier: core.frontier.toString() };
  return {
    ...fire,
    phase,
    ...(phase === "dead" ? { endFrontier: core.frontier.toString() } : {}),
  };
}
