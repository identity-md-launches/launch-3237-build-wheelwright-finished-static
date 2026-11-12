import { useEffect, useRef, useState } from "react";
import {
  CoreReader,
  decodeState,
  PROXY,
  stringify,
  type Blow,
  type CoreState,
} from "./protocol";
import { PublicApi, disagrees, parseStatus, type Status } from "./api";
import {
  acceptLive,
  livePhase,
  mayBurn,
  restRanges,
  resumeLive,
  type Fire,
} from "./game";
import { traits } from "./formula.js";
export type Piece = {
  mode: "historical" | "live";
  blows: Blow[];
  litFrontier?: string;
  endFrontier?: string;
  historyFrontier?: string;
  traits: Awaited<ReturnType<typeof traits>>;
};
const unknown = (): Status => ({
  lamp: "unknown",
  checkedAt: Date.now(),
  reason: "Checking the official wheel",
});
function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
export function useWorkshop() {
  const reader = useRef(new CoreReader(storage()));
  const api = useRef(new PublicApi());
  const [core, setCore] = useState<CoreState | null>(null);
  const [status, setStatus] = useState<Status>(unknown);
  const [history, setHistory] = useState<{
    blows: Blow[];
    frontier: string;
    rests: [string, string][];
    cached: boolean;
  } | null>(null);
  const [fire, setFireState] = useState<Fire | null>(null);
  const fireRef = useRef(fire),
    statusRef = useRef(status),
    coreRef = useRef(core);
  const [error, setError] = useState("");
  const [disagreement, setDisagreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shelf, setShelf] = useState<Piece[]>([]);
  const [notice, setNotice] = useState("");
  const identityRef = useRef(false),
    statusLock = useRef(false);
  const lock = useRef(false),
    initialized = useRef(false),
    disposed = useRef(false);
  const setFire = (next: Fire | null) => {
    fireRef.current = next;
    setFireState(next);
  };
  const saveShelf = (pieces: Piece[]) => {
    setShelf(pieces);
    try {
      storage()?.setItem("wheelwright:shelf:v1", stringify(pieces));
    } catch {
      setNotice("Shelf kept for this visit; browser storage is unavailable.");
    }
  };
  const pollStatus = async () => {
    if (statusLock.current) return;
    statusLock.current = true;
    try {
      const st = await api.current.status(identityRef.current);
      if (!disposed.current) {
        statusRef.current = st;
        setStatus(st);
      }
    } finally {
      statusLock.current = false;
    }
  };
  const sync = async () => {
    void pollStatus();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const [s, a] = await Promise.allSettled([
        (async () => {
          if (!initialized.current) {
            await reader.current.configuration();
            initialized.current = true;
          }
          return reader.current.state();
        })(),
        api.current.core(),
      ]);
      const c = s.status === "fulfilled" ? s.value : null;
      const ac = a.status === "fulfilled" ? a.value : null;
      identityRef.current = ac?.identity === true;
      const prior = statusRef.current;
      const st = prior.raw
        ? {
            ...parseStatus(
              prior.raw as Record<string, unknown>,
              identityRef.current,
            ),
            checkedAt: prior.checkedAt,
          }
        : prior;
      if (disposed.current) return;
      coreRef.current = c;
      statusRef.current = st;
      setCore(c);
      setStatus(st);
      setDisagreement(c ? disagrees(ac, c) : false);
      setError(
        c
          ? ""
          : "Contract connection unknown. Retry; certified historical blows remain playable.",
      );
      if (c) {
        const existing = fireRef.current;
        if (existing?.mode === "live") {
          let next = resumeLive(existing, st, c);
          setFire(next);
          if (
            next.phase === "burning" &&
            mayBurn(st, c) &&
            c.frontier > BigInt(next.scannedFrontier!)
          ) {
            const span = await reader.current.span(
              BigInt(next.scannedFrontier!),
              c.frontier,
              c.frontier,
            );
            if (
              fireRef.current === next &&
              mayBurn(statusRef.current, coreRef.current)
            ) {
              next = acceptLive(
                next,
                span.blows,
                span.through,
                statusRef.current,
                coreRef.current,
              );
              setFire(next);
            }
          }
        } else if (existing?.mode === "historical") {
          /* An official fire's list stays fixed after it is selected. */
        }
        const h = await reader.current.historical(c.frontier);
        if (!disposed.current)
          setHistory({
            blows: h.newest,
            frontier: c.frontier.toString(),
            rests: restRanges(h.after, h.through, h.blows),
            cached: false,
          });
      } else if (fireRef.current?.mode === "live")
        setFire({ ...fireRef.current, phase: "covered" });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to certify rounds. Retry.",
      );
    } finally {
      lock.current = false;
      if (!disposed.current) setBusy(false);
    }
  };
  useEffect(() => {
    disposed.current = false;
    const load = async () => {
      try {
        const r = await fetch("./certified-history.json", {
          credentials: "omit",
        });
        const seed = await r.json();
        if (seed.proxy !== PROXY || seed.chain !== "11155111")
          throw new Error("Snapshot identity mismatch");
        reader.current.seed([...seed.pages, ...seed.check1212]);
        const s = decodeState(seed.rawState),
          h = await reader.current.historical(s.frontier);
        if (!disposed.current)
          setHistory((old) =>
            old && !old.cached
              ? old
              : {
                  blows: h.newest,
                  frontier: s.frontier.toString(),
                  rests: restRanges(h.after, h.through, h.blows),
                  cached: true,
                },
          );
      } catch {
        /* A failed static snapshot does not block an official RPC read. */
      }
      try {
        const value = JSON.parse(
          storage()?.getItem("wheelwright:shelf:v1") ?? "[]",
        );
        if (Array.isArray(value)) {
          const valid: Piece[] = [];
          for (const p of value.slice(0, 48)) {
            if (
              !["historical", "live"].includes(p.mode) ||
              !Array.isArray(p.blows) ||
              p.blows.length > 4096
            )
              continue;
            // Stored traits are never trusted. Recomputed on load; contract verification is offered when opening.
            try {
              valid.push({ ...p, traits: await traits(p.blows) });
            } catch {
              /* invalid local record */
            }
          }
          if (!disposed.current) setShelf(valid);
        }
      } catch {
        /* Shelf storage is optional. */
      }
    };
    void load();
    void sync();
    const polling = window.setInterval(() => {
      if (!document.hidden) void sync();
    }, 6000);
    const statusPolling = window.setInterval(() => {
      if (!document.hidden) void pollStatus();
    }, 6000);
    const guard = window.setInterval(() => {
      const f = fireRef.current;
      if (f?.mode !== "live") return;
      const phase = livePhase(f, statusRef.current, coreRef.current);
      if (phase !== f.phase) setFire({ ...f, phase });
      else if (
        phase === "burning" &&
        f.blows.length < f.available.length &&
        mayBurn(statusRef.current, coreRef.current)
      ) {
        const next = f.available[f.blows.length];
        setFire({ ...f, blows: [...f.blows, next] });
        setNotice(`Official strike: round ${next.roundId}, work ${next.work}.`);
      }
    }, 650);
    const visibility = () => {
      if (document.hidden && fireRef.current?.mode === "live")
        setFire({ ...fireRef.current, phase: "covered" });
      else if (!document.hidden) void sync();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed.current = true;
      window.clearInterval(polling);
      window.clearInterval(statusPolling);
      window.clearInterval(guard);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  function historical() {
    if (!history?.blows.length || fireRef.current) return;
    setFire({
      mode: "historical",
      blows: [],
      available: history.blows,
      phase: "burning",
      historyFrontier: history.frontier,
      rests: history.rests,
    });
    setNotice(
      "Historical fire ready. Each strike uses the next official round.",
    );
  }
  async function light() {
    if (fireRef.current || !mayBurn(statusRef.current, coreRef.current)) return;
    // Lighting takes a new state read so litFrontier is the actual settled frontier at lighting.
    setBusy(true);
    try {
      const [c, a] = await Promise.all([
        reader.current.state(),
        api.current.core(),
      ]);
      const st = await api.current.status(a.identity);
      coreRef.current = c;
      statusRef.current = st;
      setCore(c);
      setStatus(st);
      if (!mayBurn(st, c) || fireRef.current) {
        setNotice("Live fire needs an online, spinning, unpaused wheel.");
        return;
      }
      setFire({
        mode: "live",
        blows: [],
        available: [],
        litFrontier: c.frontier.toString(),
        scannedFrontier: c.frontier.toString(),
        phase: "burning",
        rests: [],
      });
      setNotice(
        `Live fire lit after frontier ${c.frontier}. Only newly certified active rounds can strike.`,
      );
    } catch {
      setNotice(
        "Live lighting could not be verified. Use historical blows or retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  function strike() {
    const f = fireRef.current;
    if (!f || f.mode !== "historical" || f.blows.length >= f.available.length)
      return;
    const b = f.available[f.blows.length];
    setFire({ ...f, blows: [...f.blows, b] });
    setNotice(`Official strike: round ${b.roundId}, work ${b.work}.`);
  }
  async function quench() {
    const f = fireRef.current;
    if (
      !f?.blows.length ||
      (f.mode === "historical" && f.blows.length < f.available.length)
    )
      return null;
    const piece: Piece = {
      mode: f.mode,
      blows: [...f.blows],
      litFrontier: f.litFrontier,
      endFrontier: f.mode === "live" ? f.scannedFrontier : undefined,
      historyFrontier: f.historyFrontier,
      traits: await traits(f.blows),
    };
    if (fireRef.current !== f) return null;
    const key = piece.blows.map((b) => b.roundId).join(",");
    const pieces = [
      piece,
      ...shelf.filter(
        (p) =>
          p.mode !== piece.mode ||
          p.blows.map((b) => b.roundId).join(",") !== key,
      ),
    ].slice(0, 48);
    saveShelf(pieces);
    setFire(null);
    setNotice(`Quenched. Smith’s mark ${piece.traits.heart} is on the shelf.`);
    return piece;
  }
  return {
    core,
    status,
    history,
    fire,
    error,
    disagreement,
    busy,
    shelf,
    notice,
    setNotice,
    historical,
    light,
    strike,
    quench,
    abandon: () => {
      setFire(null);
      setNotice("Fire abandoned. No piece was kept.");
    },
    sync,
    reader: reader.current,
    api: api.current,
    canLive: mayBurn(status, core),
  };
}
