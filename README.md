# Wheelwright

A static atelier game for the Squeekchain community. The first screen is the working bench. Official historical rounds are playable even when the wheel is idle or its live status is unknown. No backend, wallet, token, NFT, payments or custody.

Site label: **wheelwright**. The finished static export is **dist/**; it is included alongside the source and lockfile. `site.json` records the intended label. Public repository publication and hosting are the submission platform’s subsequent steps; no public URL is invented here.

## Install, preview and rebuild

Use Node.js 22.12+ (validated with Node 24) and npm:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

The production build includes a typecheck. Vite uses `base: './'`. Serve the complete `dist/` directory on any static host, including a gateway subpath. All required fonts, illustrations, ABI files and certified history are local. There are no secret settings or environment files. Development dependencies and caches are excluded at every nesting level; do not submit them.

## Bench rules

1. **Historical fire:** read `state().settledThroughRound`, certify the last 144 rounds using `roundPage`, and take the newest 8 **active** rounds, in increasing ID. Gaps are rests, not missing blows. If fewer than 8 exist in that window, use all of them and disclose the count. The selected list is fixed for that fire. Strike every selected round once, then **Quench to shelf**. The same official list always produces the same finished piece.
2. **Live fire:** lighting needs an official `/v1/status` measurement with freshness `online`, `coreStatus: SPINNING`, a matching API core identity, and a successful unpaused contract read. Lighting takes another state read and records `litFrontier`. Only certified active rounds after it can strike, in order. The latest struck ID and its official work appear beside the main action.
3. **Cover and death:** unknown/unavailable status, a hidden tab, a missing contract connection or a paused core covers a burning live fire. No new blows occur while covered. On a verified spinning resume, skip the covered frontier gap rather than awarding retroactive blows. IDLE kills the live fire. It may be quenched as it is, using only blows already certified while legally burning, or abandoned. A dead fire cannot resume. A zero-blow live fire cannot be quenched.
4. **One piece:** one fire can occupy the bench. Abandoning keeps no piece. Historical fire ignores the live lamp, including pauses. Historical replay is explicit; it never claims the old round happened now.
5. **Shelf:** quenching stores up to 48 pieces in this browser’s local storage, deduplicated by mode and official list. Storage is optional; if unavailable, the current visit still works. Opening a piece shows every ID, work, data hash, difficulty, mode, recorded frontiers and the four traits. Each record is selectable and copyable. Shelf data can be recomputed against official checkpoints.

The bundled cache in `public/certified-history.json` was captured from SqueekCore on 2026-11-12 at frontier **1248**. It certifies rounds **1105–1248**, contains **23 active rounds**, and selects **1198, 1199, 1200, 1201, 1209, 1210, 1211, 1212** as the latest eight. Their Mass is **2891**, Heart **9e25440f**, Temper **8 steered / 0 light**, Grain **9769**. Raw call results are retained so these values can be independently decoded. It is explicitly labelled a certified cache until a current read succeeds; it is not presented as a live lamp.

## Official sources and deployment pin

Rechecked on **2026-11-12** against [official Deployments](https://docs.squeekchain.com/developers/#deployments):

| Item | Pin |
| --- | --- |
| Release | `core-sepolia-20261103`, revision **7** |
| Network | Ethereum Sepolia, chain **11155111** |
| SqueekCore proxy | `0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4` |
| ABI URL | [Official SqueekCore JSON](https://docs.squeekchain.com/assets/abi/SqueekCore.json) |
| Repository ABI | `abi/SqueekCore.json` |
| Runtime ABI | `dist/abi/SqueekCore.json` |
| Pin record | `abi/PIN.json` |

The checked-in ABI is an explicit read-only projection of the official ABI: `blockInfo`, `configuration`, `roundPage`, `state`, and `paused`, with unchanged tuple layouts. This game has no transaction or administrative ABI surface. The full published ABI’s direct download became inaccessible during this run; the indexed official ABI supplied the read tuples, and the actual RPC calls validated their decoding. The projection scope is recorded in `abi/PIN.json` rather than pretending it is a byte-for-byte copy of the full ABI.

The game **calls the proxy**, never an implementation or mainnet. It checks Sepolia chain ID before every provider read and verifies configuration: round duration **600 seconds**, work cap **10000**, steering threshold **40**. See [SqueekCore](https://docs.squeekchain.com/developers/core/) and [API reference](https://docs.squeekchain.com/developers/api/).

Public RPCs, in order, then an optional HTTPS Sepolia fallback set in Bench notes:

1. `https://ethereum-sepolia-rpc.publicnode.com`
2. `https://1rpc.io/sepolia`
3. `https://sepolia.gateway.tenderly.co`
4. `https://0xrpc.io/sep`

The app sends only public read RPC methods (`eth_chainId`, `eth_call`). It calls no analytics or wallet services. Its API requests are GETs to `https://api.squeekchain.com/v1/status`, `/v1/core` and the optional `/v1/settlements?range=24h` list. The settlement endpoint is never a gameplay source. Only valid hashes actually present in that listed response can be displayed; unavailable means unknown, never zero transactions. No transaction hash is synthesized.

Status polls independently every **6 seconds**, including while RPC failover is slow. An 8-second status guard covers live fires if updates stop. The API client honors `ETag`, `304` and `Retry-After`; a 304 never refreshes the age of an old measurement. Settlements are requested only by explicit refresh and otherwise have a one-minute client limit. API core identity must match the pin. If API settled values disagree with `state()`, the contract wins and the UI shows **“Using SqueekCore; the API disagrees”**. Projected, queued, provisional and optimistic values never become blows.

## Work derivation and certification

`roundPage(afterRound, throughRound, 16)` has an exclusive `afterRound`, an inclusive `throughRound` bounded by the last successful settled frontier, and a limit of 16 **active records**, not 16 adjacent IDs. A page may only partially certify the requested range. If it has not certified through the request, the next call starts after its last listed ID, or after its certified frontier when empty. The decoder validates order, range, nonzero hashes, nonzero work, cap, and endpoint cumulative work. Certified pages are cached in memory and optional local storage under the release/proxy scope.

For a page with official start cumulative work `S` and checkpoints `C1…Cn`:

```text
work(first listed round) = C1.cumulativeWork − S.cumulativeWork
work(each later round)  = Ci.cumulativeWork − C(i−1).cumulativeWork
```

The start must come from **the same call**. Omitted rounds inside a certified span are zero-work rests. Rounds beyond the settled frontier are unknown and are never requested. There are no inferred blows between checkpoints. Protocol IDs, work and difficulty use `bigint`; serialized data uses decimal strings.

## Trait formula

One implementation, `src/formula.js`, serves the bench, shelf, shared pieces, browser recompute, CLI and tests. Blows are strictly increasing official active rounds.

- **Mass:** bigint sum `W` of their official work, displayed as an integer with no invented unit.
- **Heart:** Web Crypto **SHA-256** over UTF-8 lines `{decimalRoundId}:{dataHash}`, with lowercase `0x`-prefixed 66-character hashes, joined with one newline and **no trailing newline**. Display the first **8 hex characters**, including the visible mark stamped directly into the metal.
- **Temper:** count work **≥40** as steered and work **1–39** as light. Display exactly, for example, `3 steered / 5 light`.
- **Grain:** the last blow checkpoint’s official **workPerThousandBlocks**, after that round steered. This number is authoritative.

The SVG metal silhouette and stamp use Heart, Mass and Temper deterministically. Each historical or live strike changes its silhouette and adds hammer marks; only certified rounds can cause those changes. Quenching changes the material to cold steel and retains the official traits.

### Frozen official 1212 check

On the pinned proxy, the certified single-round piece has:

```text
roundId: 1212
work: 80
dataHash: 0xf92e09fa2841de7ce610da44324b09a22acfef747dc89875ea1d6b4852b167a9
Mass: 80
Temper: 1 steered / 0 light
Heart: deb98f44
Grain: 9769
```

Its SHA-256 input is exactly this one line, with no trailing newline:

```text
1212:0xf92e09fa2841de7ce610da44324b09a22acfef747dc89875ea1d6b4852b167a9
```

`test/formula.test.js` asserts this result. Open it from Bench notes, or share:

```text
#piece=v1,11155111,0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4,historical,1212
```

### Recompute

Open a shelf piece and choose **Recompute from SqueekCore**, or run:

```sh
npm run recompute -- 1212
npm run recompute -- --snapshot 1212
npm run recompute -- 1198 1199 1200 1201 1209 1210 1211 1212
```

The first form checks the current frontier via public Sepolia RPCs; the snapshot form is fully offline. Certified immutable page caches may be reused. Matching checks compare **Mass, Heart, Temper and Grain** as well as each blow’s official work, hash and difficulty. An unavailable fresh read is labelled when cached certification is used. `scripts/capture.ts` can refresh the bundled public cache with read-only calls; inspect its result and rebuild before publishing a new export.

## Share format

Only these exact formats are accepted:

```text
#piece=v1,11155111,<lowercase pinned 0x proxy>,historical,<increasing official ids>
#piece=v1,11155111,<lowercase pinned 0x proxy>,live,<increasing official ids>
```

At least one positive increasing official ID is required. Invalid versions, networks, proxies, modes, duplicates, rests, future IDs and arbitrary URL strings are rejected. Parsing is strict and never evaluates URL text. Shared pieces reconstruct from certified `roundPage` data without `/v1/settlements`. Live lighting/ending frontiers are local provenance and are **not encoded** by this fixed hash format; imported live links display them as unknown rather than inventing them.

## How this project uses Squeekchain

Wheelwright turns Squeekchain’s certified physical work into a small act of craft. Each hammer blow uses one settled active round from the official SqueekCore proxy on Sepolia. Historical rounds let anyone play while the wheel rests; live fires follow only newly certified work under a verified spinning lamp. A piece’s mass, temper, grain and visible smith’s mark can be recomputed from its public round records. No wallet, token or purchase is involved.

## Cover and design

`artifacts/headline-image.png` and its runtime copy are an original **1920×1080** PNG of a heavy bench, ember forge and centred workpiece, **1,063,206 bytes**, below 4 MB. It is distinct from the interactive SVG bench and is not an existing Code card or UI screenshot. `headline-image.led-preview.png` is a **64×36 centre-crop downsample nearest-neighbour upscaled to 1024×576**. The anvil, bench, hammer and ember silhouettes were visually inspected at that resolution. The picture is not uploaded by this app.

**Cover limitation:** the official Code service/ramp could not be retrieved in this run. The supplied preview retains the cover’s actual sampled colours; it does **not** claim verified official-ramp equivalence. An exact official-ramp preview remains unverified rather than substituting guessed “official” palette values.

`DESIGN.md` documents the final implementation. The six-domain Better Interface review, actual checks, fixes, browser evidence and remaining limits are in `artifacts/validation.md`. Third-party design and font notices are in `THIRD_PARTY_NOTICES.md`.

## Validation performed

- `npm test`: **17 passed** (4 formula checks and 13 protocol/game checks).
- `npm run typecheck`: passed.
- `npm run build`: passed; complete relative-path production export in `dist/`.
- Online and offline CLI recompute of official **1212**: expected Mass, Temper, Heart and Grain.
- `scripts/validate-browser.mjs`: Chromium historical and live primary flows, clipboard share, storage persistence, strict malformed-hash rejection, exact 1212 import, offline service failure, and no overflow at **320, 390, 720, 1000 and 1440**. Fixtures use captured official round records and explicitly simulated lamps/frontiers; they are not claims about the real wheel’s current status.
- Pinned `taste.mjs`: **16/16 checks passed** after the repeated connection message was corrected; screenshots reviewed at 390 and 1440. Reproduce while the pinned inputs are available:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

For standalone interaction checks, install the Playwright browsers and run `node scripts/validate-browser.mjs`; the script serves the export beneath `/preview/` in one bounded process. `node scripts/check-export.mjs` verifies local assets, cover dimensions, ABI parity, absence of dependency archives and the **8 MiB** submission limit.

**Environment and coverage limits:** the supplied browser tool could not launch because its socket path was too long. A separate Playwright Chromium session successfully inspected and exercised the actual production export. WebKit downloaded but could not launch due to missing system libraries; a local dependency attempt failed because the package database is unavailable. No Safari, physical-device, screen-reader or browser-native 200% zoom pass is claimed. The real API returned an access/unavailable response during inspection, so legal live transitions were validated with explicit fixtures, while the actual Sepolia RPC supplied the official certified records. Official-ramp verification and the full-ABI byte pin are limited as described above. The platform’s final path/byte verifier does not independently certify these reported behavioral checks.

## Submission budget

The explicit `.gitignore` path budget is **1 KiB** for that file. It ignores only generated dependency/cache directories at every depth, TypeScript build metadata, and `test/scratch/`. It does **not** ignore `dist/`; explicit negations also retain `artifacts/**` despite an inherited artifact exclusion. Source, lockfile, required runtime assets, named cover artifacts, design documentation and evidence are retained. `artifacts/bundle-budget.json` records the measured included bytes; generated dependencies, downloaded browser runtimes and all scratch work are excluded. No submodule is used.
