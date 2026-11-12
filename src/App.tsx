import { useEffect, useRef, useState } from "react";
import { Bench, PieceArt } from "./Bench";
import { useWorkshop, type Piece } from "./useWorkshop";
import {
  CHAIN,
  PROXY,
  RPCS,
  parseShare,
  shareHash,
  type Blow,
} from "./protocol";
import { traits, type Traits } from "./formula";
import "./style.css";
function HammerIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="m8 25 13-14M14 6l5-5 12 10-5 6z"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path d="m3 26 4 4 4-4-4-4z" fill="currentColor" />
    </svg>
  );
}
function Arrow({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true">{down ? "↓" : "↗"}</span>;
}
export default function App() {
  const w = useWorkshop();
  const [value, setValue] = useState<Traits | null>(null);
  const [opened, setOpened] = useState<Piece | null>(null);
  const [recompute, setRecompute] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [rpc, setRpc] = useState("");
  const [rpcMessage, setRpcMessage] = useState("");
  const [sharing, setSharing] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const imported = useRef("");
  const [txs, setTxs] = useState<string[] | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const count = w.fire?.blows.length ?? 0;
  const sourceBlows = w.fire?.available ?? w.history?.blows ?? [];
  useEffect(() => {
    let active = true;
    if (!count) {
      setValue(null);
      return;
    }
    void traits(w.fire!.blows)
      .then((t) => {
        if (active) setValue(t);
      })
      .catch(() =>
        w.setNotice("Unable to compute this piece. Retry the official blows."),
      );
    return () => {
      active = false;
    };
  }, [w.fire?.blows]);
  useEffect(() => {
    if (opened) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      previousFocus.current?.focus();
    }
  }, [opened]);
  useEffect(() => {
    const read = async () => {
      const hash = window.location.hash;
      if (!hash || hash === imported.current) return;
      imported.current = hash;
      try {
        const request = parseShare(hash);
        if (!request) return;
        const frontier =
          w.core?.frontier ?? (w.history ? BigInt(w.history.frontier) : null);
        if (frontier === null) {
          imported.current = "";
          return;
        }
        w.setNotice("Verifying the shared official blows…");
        const blows = await w.reader.resolve(request.ids, frontier);
        setOpened({ mode: request.mode, blows, traits: await traits(blows) });
        setRecompute(
          "Shared official rounds verified. Live frontiers are not encoded in a piece link.",
        );
        setSharing("");
        w.setNotice("Shared piece opened. Every blow is certified.");
      } catch (e) {
        w.setNotice(e instanceof Error ? e.message : "Invalid piece link.");
      }
    };
    void read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [w.core?.frontier, w.history?.frontier]);
  const copy = async (text: string) => {
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.cssText =
          "position:fixed;opacity:0;inset:0;width:1px;height:1px";
        document.body.append(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      w.setNotice("Copied to clipboard.");
      setSharing("Copied to clipboard.");
    } catch {
      const link = dialog.current?.querySelector(".share-link");
      link?.setAttribute("open", "");
      w.setNotice(
        "Clipboard is unavailable. Select and copy the visible value.",
      );
      setSharing("Select and copy the visible link below.");
    }
  };
  function openPiece(p: Piece) {
    setOpened(p);
    setRecompute(
      "Recompute checks this piece against certified SqueekCore rounds.",
    );
    setSharing("");
  }
  async function verifyPiece() {
    if (!opened || verifying) return;
    setVerifying(true);
    setRecompute("Reading official checkpoints…");
    try {
      let frontier: bigint;
      let cached = false;
      try {
        frontier = (await w.reader.state()).frontier;
      } catch {
        if (!w.history)
          throw new Error("No certified frontier available. Retry.");
        frontier = BigInt(w.history.frontier);
        cached = true;
      }
      const official = await w.reader.resolve(
        opened.blows.map((b) => b.roundId),
        frontier,
      );
      const t = await traits(official),
        stored = opened.traits;
      const matches = ["mass", "heart", "temper", "grain"].every(
        (k) => t[k as keyof Traits] === stored[k as keyof Traits],
      );
      if (
        !matches ||
        official.some(
          (b, i) =>
            b.work !== opened.blows[i].work ||
            b.dataHash !== opened.blows[i].dataHash ||
            b.workPerThousandBlocks !== opened.blows[i].workPerThousandBlocks,
        )
      )
        throw new Error(
          "Mismatch. This local piece does not match its official checkpoints.",
        );
      setRecompute(
        `Match: Mass ${t.mass}, Heart ${t.heart}, Temper ${t.temper}, Grain ${t.grain}.${cached ? " Using cached certified pages; the current RPC is unavailable." : " Certified SqueekCore checkpoints verified."}`,
      );
    } catch (e) {
      setRecompute(e instanceof Error ? e.message : "Could not verify. Retry.");
    } finally {
      setVerifying(false);
    }
  }
  const quench = async () => {
    const p = await w.quench();
    if (p) openPiece(p);
  };
  const full = !!w.fire && count === w.fire.available.length && count > 0;
  const action = !w.fire
    ? w.history?.blows.length
      ? "Forge historical piece"
      : "Retry official blows"
    : w.fire.mode === "historical"
      ? full
        ? "Quench to shelf"
        : `Strike round ${sourceBlows[count]?.roundId}`
      : count
        ? "Quench to shelf"
        : "Awaiting an official blow";
  async function primary() {
    if (!w.fire) {
      if (w.history?.blows.length) w.historical();
      else await w.sync();
    } else if (w.fire.mode === "historical" && !full) w.strike();
    else await quench();
  }
  const stamp = sourceBlows.length
    ? `${sourceBlows[0].roundId}–${sourceBlows.at(-1)!.roundId}`
    : "loading";
  const latest = w.fire?.blows.at(-1);
  const visibleRests = (w.fire?.rests ?? w.history?.rests ?? []).filter(
    ([a, b]) =>
      sourceBlows.length &&
      BigInt(b) > BigInt(sourceBlows[0].roundId) &&
      BigInt(a) < BigInt(sourceBlows.at(-1)!.roundId),
  );
  const liveLabel = w.core?.paused
    ? "SqueekCore paused"
    : w.status.lamp === "spinning"
      ? "Wheel spinning"
      : w.status.lamp === "idle"
        ? "Wheel idle"
        : "Wheel unknown";
  return (
    <>
      <a
        className="skip"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("bench")?.focus();
        }}
      >
        Skip to the bench
      </a>
      <div className="atelier">
        <header className="masthead">
          <div className="brand">
            <span className="brand-mark">
              <HammerIcon />
            </span>
            <h1>Wheelwright</h1>
          </div>
          <nav aria-label="Workshop">
            <button
              className="nav-active"
              onClick={() =>
                document
                  .getElementById("bench")
                  ?.scrollIntoView({ behavior: "instant" })
              }
            >
              The bench
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("shelf")
                  ?.scrollIntoView({ behavior: "instant" })
              }
            >
              Shelf <span className="shelf-count">{w.shelf.length}</span>
            </button>
            <button
              className="notes-nav"
              onClick={() => {
                const el = document.getElementById(
                  "notes",
                ) as HTMLDetailsElement;
                el.open = true;
                el.scrollIntoView({ behavior: "instant" });
              }}
            >
              Bench notes <Arrow />
            </button>
          </nav>
        </header>
        <div className="intro-row">
          <p>No spin, no fire. Every blow is a settled round.</p>
          <span className="community-label">
            A Squeekchain community atelier
          </span>
        </div>
        <main>
          <section
            className="bench-panel"
            id="bench"
            tabIndex={-1}
            aria-label="The playable bench"
          >
            <div className="bench-bar">
              <div className="bench-title">
                <HammerIcon />
                <h2>The working bench</h2>
              </div>
              <div className={`lamp ${w.status.lamp}`}>
                <span className="lamp-dot" />
                {liveLabel}
                <button
                  className="refresh"
                  onClick={() => void w.sync()}
                  disabled={w.busy}
                  aria-label="Refresh official data"
                  title="Refresh official data"
                >
                  ↻
                </button>
              </div>
            </div>
            <div className="bench-grid">
              <Bench
                value={value}
                count={count}
                historical={w.fire?.mode !== "live"}
                phase={w.fire?.phase ?? "unlit"}
                strikeKey={count}
              />
              <div className="forge-controls">
                <div className="fire-choice">
                  <span className="fire-type">
                    {w.fire?.mode === "live" ? "Live fire" : "Historical fire"}
                  </span>
                  <span className="small muted">
                    {w.fire ? "On the anvil" : "Ready to forge"}
                  </span>
                </div>
                <h3>
                  {w.fire?.phase === "covered"
                    ? "The fire is covered."
                    : w.fire?.phase === "dead"
                      ? "The live fire has died."
                      : count
                        ? full && w.fire?.mode === "historical"
                          ? "Ready for the water."
                          : "Every blow leaves a mark."
                        : "Make something settled."}
                </h3>
                <p className="fire-description">
                  {w.fire?.mode === "live"
                    ? `Lit after frontier ${w.fire.litFrontier}. ${w.fire.phase === "covered" ? "No new blows until the wheel is verified online, spinning and unpaused." : w.fire.phase === "dead" ? "Quench the blows already struck, or abandon this fire." : "New certified active rounds strike automatically."}`
                    : "Take official rounds to the anvil. Strike each one, then quench the finished piece."}
                </p>
                <div className="piece-progress">
                  <span>
                    {w.fire?.mode === "live"
                      ? "Official blows"
                      : "Blows struck"}
                  </span>
                  <strong>
                    {count}
                    <span className="muted">
                      {w.fire?.mode !== "live"
                        ? ` / ${sourceBlows.length || "…"}`
                        : ""}
                    </span>
                  </strong>
                </div>
                <div className="stroke-track" aria-hidden="true">
                  {Array.from(
                    {
                      length:
                        w.fire?.mode === "live"
                          ? Math.max(count, 8)
                          : sourceBlows.length || 8,
                    },
                    (_, i) => (
                      <span className={i < count ? "struck" : ""} key={i} />
                    ),
                  )}
                </div>
                <button
                  className="primary"
                  onClick={() => void primary()}
                  disabled={
                    (w.busy && !w.history) ||
                    (w.fire?.mode === "live" && count === 0)
                  }
                >
                  <span>{action}</span>
                  {full || (w.fire?.mode === "live" && count) ? (
                    <Arrow down />
                  ) : (
                    <HammerIcon />
                  )}
                </button>
                <div className="action-hint">
                  {w.fire
                    ? w.fire.mode === "historical"
                      ? full
                        ? "Cool the iron. Keep its official record."
                        : `Next blow: ${sourceBlows[count]?.work} official work`
                      : latest
                        ? `Latest #${latest.roundId} · work ${latest.work}`
                        : "A zero-blow live fire cannot be quenched."
                    : "The newest 8 active rounds. Rests never strike."}
                </div>
                <div className="secondary-actions">
                  {w.fire ? (
                    <button className="quiet" onClick={w.abandon}>
                      Abandon fire
                    </button>
                  ) : (
                    <button
                      className="quiet"
                      onClick={() => void w.light()}
                      disabled={!w.canLive || w.busy}
                    >
                      Light live fire <span aria-hidden="true">↗</span>
                    </button>
                  )}
                  <span className="small muted">
                    {!w.fire && !w.canLive
                      ? "Needs an online, spinning wheel"
                      : w.fire?.mode === "live"
                        ? w.fire.phase
                        : "One piece at a time"}
                  </span>
                </div>
              </div>
            </div>
            <div className="official-strip">
              <span className="official-icon" aria-hidden="true">
                ✓
              </span>
              <p>
                {w.fire?.mode === "live"
                  ? `Official live blows after round ${w.fire.litFrontier}`
                  : `Official historical blows, rounds ${stamp}`}
              </p>
              <span className="small muted">
                {sourceBlows.length &&
                sourceBlows.length < 8 &&
                w.fire?.mode !== "live"
                  ? `Only ${sourceBlows.length} active rounds in the certified window`
                  : `${w.history?.cached ? "Cached certified" : "Certified"} through ${w.history?.frontier ?? "…"}`}
              </span>
            </div>
          </section>
          <div className="bench-feedback" role="status" aria-live="polite">
            {w.notice ||
              (w.error
                ? "Historical forging is available from the certified cache."
                : w.history?.cached
                  ? "Certified historical cache is ready. Checking the current frontier."
                  : "Select an official fire. Give its rounds a shape.")}
          </div>
          {(w.disagreement || w.core?.paused || w.error) && (
            <div className="connection-note">
              {w.disagreement && <p>Using SqueekCore; the API disagrees</p>}
              {w.core?.paused && (
                <p>
                  SqueekCore is paused. Live fires are covered; historical
                  forging is available.
                </p>
              )}
              {w.error && (
                <p>
                  {w.error}{" "}
                  <button
                    className="text-button"
                    onClick={() => void w.sync()}
                    disabled={w.busy}
                  >
                    Retry connection
                  </button>
                </p>
              )}
            </div>
          )}
          <section
            className="underbench"
            aria-label="Piece traits and official timeline"
          >
            <div className="traits-panel">
              <div className="section-heading">
                <h2>The piece</h2>
                <span className="small muted">
                  {count ? "Shaped by official work" : "Unstruck iron"}
                </span>
              </div>
              <TraitList value={value} />
            </div>
            <div className="timeline-panel">
              <div className="section-heading">
                <h2>Official blows</h2>
                <span className="small muted">Oldest first</span>
              </div>
              <ol className="round-timeline">
                {sourceBlows.map((b, i) => (
                  <li className={i < count ? "hit" : ""} key={b.roundId}>
                    <span className="timeline-head">
                      <span className="tiny-anvil" aria-hidden="true">
                        {i < count ? "✓" : "·"}
                      </span>
                      <span>#{b.roundId}</span>
                    </span>
                    <span className="small muted">{b.work} work</span>
                  </li>
                ))}
              </ol>
              {visibleRests.length > 0 && (
                <div className="visible-rests">
                  {visibleRests.map(([a, b]) => (
                    <p key={a}>
                      <span aria-hidden="true">―</span> Rounds {a}–{b} · 0 work
                      · rest
                    </p>
                  ))}
                </div>
              )}
              {!sourceBlows.length && (
                <p className="muted small">
                  Reading certified rounds. The bench stays here if the
                  connection fails.
                </p>
              )}
              <details className="rests">
                <summary>View certified rests</summary>
                <p className="small muted">
                  Zero-work rounds are rests. They never hit the anvil. Rounds
                  beyond the frontier are unknown.
                </p>
                <ul>
                  {(w.fire?.rests ?? w.history?.rests ?? []).map(([a, b]) => (
                    <li key={a}>
                      Round{a !== b ? "s" : ""} {a}
                      {a !== b ? `–${b}` : ""} · 0 work · rest
                    </li>
                  ))}
                </ul>
                {(w.fire?.rests ?? w.history?.rests)?.length === 0 && (
                  <p className="small">No rests in this certified span.</p>
                )}
              </details>
            </div>
          </section>
          <section className="shelf" id="shelf">
            <div className="section-heading">
              <h2>
                The cooling shelf{" "}
                <span className="muted">({w.shelf.length})</span>
              </h2>
              <span className="small muted">Kept in this browser</span>
            </div>
            {!w.shelf.length ? (
              <div className="empty-shelf">
                <svg viewBox="0 0 56 40" aria-hidden="true">
                  <path
                    d="M5 31h46M11 32v6m34-6v6M15 20l7 5h14l7-6-9 1-1-6H24l-2 6z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <div>
                  <h3>A place for what you make.</h3>
                  <p>
                    Quench a piece from the bench. Its blows and smith’s mark
                    stay with it.
                  </p>
                </div>
                <span className="shelf-arrow" aria-hidden="true">
                  ↑
                </span>
              </div>
            ) : (
              <div className="shelf-grid">
                {w.shelf.map((p, i) => (
                  <button
                    className="shelf-piece"
                    key={`${p.mode}-${p.traits.heart}-${i}`}
                    onClick={() => openPiece(p)}
                  >
                    <div className="shelf-art">
                      <svg viewBox="130 115 380 160" aria-hidden="true">
                        <PieceArt
                          small
                          cold
                          value={p.traits}
                          count={p.blows.length}
                        />
                      </svg>
                    </div>
                    <span className="shelf-piece-label">
                      <strong>{p.traits.heart}</strong>
                      <span>
                        {p.mode} · {p.blows.length}{" "}
                        {p.blows.length === 1 ? "blow" : "blows"} <Arrow />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <details id="notes" className="bench-notes">
            <summary>
              <span>Bench notes</span>
              <span className="small muted">
                The rules, the sources, the work{" "}
                <span aria-hidden="true">+</span>
              </span>
            </summary>
            <div className="notes-grid">
              <div>
                <h3>Work the official iron.</h3>
                <p>
                  Historical fire uses the newest 8 official active rounds from
                  the last 144 certified rounds, in order. Strike each once and
                  quench. Fewer than 8? All available active rounds make the
                  fire.
                </p>
                <p>
                  Live fire needs an online SPINNING lamp and an unpaused core.
                  It records the frontier at lighting; only later certified
                  active rounds can strike. Idle ends the fire. Unknown status,
                  a hidden tab or a pause covers it. Rounds certified during a
                  cover are skipped on resume.
                </p>
                <p>
                  Abandoning keeps nothing. The shelf is local to this browser.
                  A piece link can reconstruct its certified blows anywhere,
                  without the settlements API.
                </p>
              </div>
              <div>
                <h3>Four traits. One record.</h3>
                <p>
                  Mass is summed official work. Temper counts work ≥ 40 as
                  steered and 1–39 as light. Heart is the first 8 hex of SHA-256
                  of ordered <code>roundId:dataHash</code> lines, lowercase
                  hashes, single newlines, no trailing newline. Grain is the
                  last checkpoint’s official <code>workPerThousandBlocks</code>.
                </p>
                <p>
                  The stamped form uses Heart, Mass and Temper. No minting,
                  ownership, wallet or token is involved.
                </p>
                <button
                  className="quiet"
                  onClick={async () => {
                    try {
                      const frontier =
                        w.core?.frontier ?? BigInt(w.history?.frontier ?? "0");
                      const blows = await w.reader.resolve(["1212"], frontier);
                      openPiece({
                        mode: "historical",
                        blows,
                        traits: await traits(blows),
                      });
                    } catch (e) {
                      w.setNotice(
                        e instanceof Error
                          ? e.message
                          : "Retry the 1212 check.",
                      );
                    }
                  }}
                >
                  Open the official 1212 check <Arrow />
                </button>
              </div>
              <div className="source-notes">
                <h3>Public sources</h3>
                <p>
                  <a
                    href="https://docs.squeekchain.com/developers/#deployments"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Deployments ↗
                  </a>{" "}
                  · core-sepolia-20261103 r7
                  <br />
                  Sepolia · chain {CHAIN.toString()}
                </p>
                <button
                  className="copy-address"
                  onClick={() => void copy(PROXY)}
                  title="Copy official proxy"
                >
                  {PROXY}
                  <span>Copy proxy</span>
                </button>
                <p>
                  <a
                    href="./abi/SqueekCore.json"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Pinned SqueekCore ABI ↗
                  </a>
                  <br />
                  <a
                    href="https://docs.squeekchain.com/assets/abi/SqueekCore.json"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official ABI source ↗
                  </a>
                </p>
                <p>
                  Round work is each listed cumulative checkpoint minus the same
                  call’s start, then the previous listed checkpoint. The
                  contract’s settled frontier is the limit.
                </p>
                <p className="small muted">RPC order: {RPCS.join(" → ")}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      w.reader.setCustom(rpc.trim());
                      setRpcMessage(
                        "Sepolia fallback saved for this visit. Public RPCs are tried first.",
                      );
                      void w.sync();
                    } catch (e) {
                      setRpcMessage(
                        e instanceof Error
                          ? e.message
                          : "Use an HTTPS Sepolia RPC.",
                      );
                    }
                  }}
                >
                  <label htmlFor="rpc">Custom Sepolia RPC (optional)</label>
                  <input
                    id="rpc"
                    type="url"
                    value={rpc}
                    onChange={(e) => setRpc(e.target.value)}
                    placeholder="https://…"
                    autoComplete="off"
                  />
                  <button className="quiet" type="submit">
                    Save fallback
                  </button>
                  <p role="status" className="small">
                    {rpcMessage}
                  </p>
                </form>
              </div>
              <div>
                <h3>Settled transaction, last 24h</h3>
                <p>
                  This optional list contains only the API’s newest settlements
                  that completed Squeek blocks. It never supplies game blows.
                </p>
                <button
                  className="quiet"
                  disabled={txBusy}
                  onClick={async () => {
                    setTxBusy(true);
                    try {
                      setTxs(await w.api.settlements(true));
                    } catch {
                      setTxs(null);
                      w.setNotice(
                        "The settlement list is unknown. No transaction hash has been invented.",
                      );
                    } finally {
                      setTxBusy(false);
                    }
                  }}
                >
                  {txBusy
                    ? "Reading transactions…"
                    : "Refresh listed transactions"}
                </button>
                {txs === null ? (
                  <p className="small muted">
                    Transaction list unknown; not needed to play.
                  </p>
                ) : !txs.length ? (
                  <p>
                    No listed settlements completed blocks in this 24h window.
                  </p>
                ) : (
                  <ul className="transaction-list">
                    {txs.map((tx) => (
                      <li key={tx}>
                        <button
                          className="copy-address"
                          onClick={() => void copy(tx)}
                        >
                          {tx}
                          <span>Copy listed transaction</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        </main>
        <footer>
          <span className="footer-brand">
            <HammerIcon />
            Wheelwright
          </span>
          <p>
            Community game reading public Squeekchain data, not an official
            product.
          </p>
          <span className="small muted">No wallet. Just work.</span>
        </footer>
      </div>
      <dialog
        ref={dialog}
        className="piece-dialog"
        onCancel={() => setOpened(null)}
        onClose={() => setOpened(null)}
        aria-labelledby="piece-title"
      >
        {opened && (
          <>
            <div className="dialog-heading">
              <div>
                <h2 id="piece-title">Ironwork {opened.traits.heart}</h2>
                <p className="small muted">
                  {opened.mode === "historical"
                    ? "Official historical piece"
                    : "Official live piece"}{" "}
                  · {opened.blows.length} official{" "}
                  {opened.blows.length === 1 ? "blow" : "blows"}
                </p>
              </div>
              <button
                className="close-dialog"
                aria-label="Close piece"
                onClick={() => setOpened(null)}
              >
                ×
              </button>
            </div>
            <div className="finished-piece">
              <svg
                viewBox="100 90 440 200"
                aria-label={`Finished ironwork, smith’s mark ${opened.traits.heart}`}
                role="img"
              >
                <PieceArt
                  value={opened.traits}
                  count={opened.blows.length}
                  cold
                />
              </svg>
            </div>
            <TraitList value={opened.traits} />
            <div className="provenance">
              <h3>Official record</h3>
              <p className="small">
                Sepolia {CHAIN.toString()} · {opened.mode}
              </p>
              <button className="copy-address" onClick={() => void copy(PROXY)}>
                {PROXY}
                <span>Copy proxy</span>
              </button>
              {opened.mode === "live" && (
                <p>
                  Lit frontier:{" "}
                  {opened.litFrontier ?? "not encoded in shared link"}
                  <br />
                  Last eligible frontier:{" "}
                  {opened.endFrontier ?? "not encoded in shared link"}
                </p>
              )}
              {opened.historyFrontier && (
                <p>
                  Historical selection certified through round{" "}
                  {opened.historyFrontier}.
                </p>
              )}
              <ol className="blow-record">
                {opened.blows.map((b) => (
                  <li key={b.roundId}>
                    <div>
                      <strong>Round {b.roundId}</strong>
                      <span>Work {b.work}</span>
                      <button
                        className="text-button"
                        onClick={() =>
                          void copy(
                            `roundId: ${b.roundId}\nwork: ${b.work}\ndataHash: ${b.dataHash}\nworkPerThousandBlocks: ${b.workPerThousandBlocks}`,
                          )
                        }
                      >
                        Copy blow
                      </button>
                    </div>
                    <code>{b.dataHash}</code>
                    <span className="small muted">
                      Official workPerThousandBlocks: {b.workPerThousandBlocks}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="dialog-actions">
                <button
                  className="primary"
                  onClick={() => void verifyPiece()}
                  disabled={verifying}
                >
                  {verifying ? "Recomputing…" : "Recompute from SqueekCore"}
                  <span aria-hidden="true">↻</span>
                </button>
                <button
                  className="quiet"
                  onClick={() =>
                    void copy(
                      window.location.href.split("#")[0] +
                        shareHash(opened.mode, opened.blows),
                    )
                  }
                >
                  Copy piece link <Arrow />
                </button>
              </div>
              <p className="recompute-result" role="status">
                {recompute}
              </p>
              <p role="status" className="small muted">
                {sharing}
              </p>
              <details className="share-link">
                <summary>Show piece link</summary>
                <code>
                  {window.location.href.split("#")[0] +
                    shareHash(opened.mode, opened.blows)}
                </code>
              </details>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
function TraitList({ value }: { value: Traits | null }) {
  return (
    <dl className="trait-list">
      <div>
        <dt>Mass</dt>
        <dd className="numeric">{value?.mass ?? "·"}</dd>
        <span className="small muted">Official physical work</span>
      </div>
      <div>
        <dt>Heart</dt>
        <dd className="numeric heart-value">{value?.heart ?? "·"}</dd>
        <span className="small muted">The smith’s mark</span>
      </div>
      <div>
        <dt>Temper</dt>
        <dd>{value?.temper ?? "·"}</dd>
        <span className="small muted">Steered ≥ 40 · light 1–39</span>
      </div>
      <div>
        <dt>Grain</dt>
        <dd className="numeric">{value?.grain ?? "·"}</dd>
        <span className="small muted">Official workPerThousandBlocks</span>
      </div>
    </dl>
  );
}
