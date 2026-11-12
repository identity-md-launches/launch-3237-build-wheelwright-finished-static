# Wheelwright validation and design review

Date: 2026-11-12. This is the worker’s report of local checks, not independent certification.

## Scope and completion

The original one-page atelier, source, lockfile, local fonts, read ABI projection, certified historical cache, covers, documentation and production `dist/` are delivered. The game/export has passed the checks below. **Two strict source/cover items remain limited:** an exact official-Code-ramp preview could not be verified, and the ABI pin is a documented official read-interface projection rather than a byte-for-byte full published ABI download. These are not silently claimed complete. The public repository and hosting label `wheelwright` are **after review**, handled by the submission platform.

No essential requester-only address, key, account or choice is missing; no input blocker or stand-in was created. Network service failures were handled locally and recorded. There is no wallet, backend, mint, money, token, NFT or transaction flow.

One-sentence design idea: an industrial steel bench turns certified physical work into a visibly stamped billet, with copper controls and a cold shelf for finished pieces.

## Requirements review

| Brief requirement | Result and evidence |
| --- | --- |
| “h1: Wheelwright”; exact title, tagline and meta | Met in `src/App.tsx` / `index.html`; h1 text and share metadata checked in production. The tagline appears once on the opening screen. |
| “first screen must be a playable bench” at 390 | Met. `screenshots/first-screen-390.png`; browser asserts main action bottom is inside 844px. The cache makes official historical play available through simultaneous API/RPC failure. |
| Historical newest 8 active from 144 certified rounds | Met. Actual captured frontier 1248, 23 active in span, selected IDs 1198,1199,1200,1201,1209,1210,1211,1212. Pagination and same-call work derivation tested. |
| Frontier bound, active-only pages, rests, bigint | Met. `src/protocol.ts`, `test/protocol.test.ts`; no page beyond frontier, empty partial page progress, sorted active records, explicit visible zero-work rests. |
| Live online/SPINNING/unpaused gate | Met in source and fixture browser transitions. No real current spinning state is claimed. Unknown/stale/paused/hidden states cover; IDLE dies; dead cannot relight; zero blows cannot quench. |
| One piece, visible change per blow, shelf provenance | Met. Browser records eight distinct metal polygons, quench, eight full records, stored shelf, native detail dialog, visible Heart stamp and live frontiers. |
| Exact traits and recompute; official 1212 | Met. Unit, CLI and browser checks: Mass 80, Temper `1 steered / 0 light`, Heart `deb98f44`, Grain 9769. Eight-blow piece recomputes to Mass 2891, Heart 9e25440f, Temper 8 steered / 0 light, Grain 9769. |
| Exact v1 share, no settlements dependency | Met. Canonical lowercase proxy and increasing IDs; malformed versions/networks/modes/duplicates/URL text rejected. 1212 import and clipboard contents verified. |
| Public GET API, identity, ETag, Retry-After | Met in source and client tests. `/v1/core` uses the published `core` object and `identities.core`; mismatch warning trusts the contract. API status polls independently every 6s. |
| Optional listed 24h transaction, no invented hash | Met in source. Only valid nonzero hashes from the listed response can be shown. Real API list was unavailable, so no real listed transaction is claimed. |
| Pinned Deployments / ABI | Release r7 and proxy rechecked. Official read tuples and actual RPC decoding pinned. **Limited:** direct full ABI fetch became inaccessible; checked-in ABI explicitly contains the five published read methods. |
| Square favicon, local fonts, static relative export | Met. Local Barlow/Barlow Condensed, square SVG favicon, title/meta/OG. Asset traversal and subpath browser check pass. |
| 1920×1080 PNG cover under 4 MB | Met. 1,063,206 bytes; original generated atelier illustration, not a screenshot or existing Code card. Readable anvil, bench, workpiece, hammer and ember silhouettes visually inspected. |
| 64×36 nearest-neighbour LED preview | Geometry/export met: 1024×576 nearest upscale of 64×36 centre crop. **Limited:** source colours retained; exact official ramp unavailable and not fabricated. The preview necessarily depicts the same required source image. |
| README / DESIGN / formula test / export | Met; files delivered. Named cover artifacts and screenshots explicitly included despite inherited artifact exclusion. |
| Site label / public repo / hosting | `site.json` says wheelwright. Publication is after review; no deployment command or fabricated public URL. |

No feature was identified as fabricated. The cache, local shelf, simulated validation lamps and unavailable external services are explicitly labelled.

## Six-domain Better Interface coverage

The pinned guide’s workflow and core principles for all six domains were read during implementation. One consolidated review was applied to the finished production export.

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native buttons, headings, main/nav/footer, lists, definition list, native details/dialog, labels, selectable/copyable records, live region, 44px targets, visible focus, Enter strikes, Tab stays in dialog, Escape and focus return. `screenshots/keyboard-focus-390.png`. Screen-reader session, physical touch and native 200% zoom unperformed. |
| Layout | Checked | Product/action together at 390; no overflow at 320/390/720/1000/1440 in browser interactions, probe 320/390/1440. Two-column bench stacks at 720; hashes wrap. `screenshots/first-screen-390.png`, `first-screen-1440.png`. RTL mirror unperformed; English-only scope. |
| Writing | Checked | Verb-first forge/strike/quench/retry actions; per-round work adjacent; unknown and paused wording stays distinct from idle; shelf says browser-local; no invented settlement or ownership claim; duplicate connection message fixed. |
| Typography | Checked | Three local/system families, three weights, six sizes; full values wrap, no ellipsis; monospace limited to official data; loaded local files confirmed by screenshots and no missing asset errors. Native text enlargement not claimed. |
| Colors | Checked | Actual rendered probe solid pairs pass; calculated implemented pairs recorded in DESIGN.md (muted/surface 6.87:1, primary button 7.87:1). Status has text/shape cues. Artwork gradients, SVG tiny decorative lettering and all forced-colour combinations not fully audited. |
| UI | Checked | Hover/disabled/focus/press, unknown/retry, raw/struck/quench/shelf/dialog, cover/dead/resume; reduced-motion media handling; no endless motion, `transition: all`, cards-in-cards or border+shadow stack. Native WebKit and slowed DevTools animation inspection unperformed. |

Wallet-connector guidance was read as supplied input; no wallet skill was applied because the brief explicitly requires no wallet.

## Findings and fixes

| Severity / domain | Source location and observed issue | Fix and recheck |
| --- | --- | --- |
| High / UI-data | `src/api.ts:20`: storing native `fetch` and invoking it as an instance member caused a browser receiver error; status never issued network requests. The first live interaction run could not enable lighting. | Default fetcher now delegates through an arrow function. Rebuilt; legal lighting, 1212 strike, unknown cover, resume, pause and IDLE scenarios pass in the actual Chromium export. |
| High / data | `src/api.ts:75`: the implementation initially expected a `state` object instead of published API `core`. | Aligned to official `core` and `identities.core`, added schema validation and a focused API parser/disagreement test. Rebuilt and live browser run passes. |
| High / data freshness | `src/useWorkshop.ts:77`: a status request tied to slow RPC failover could miss the ≤8s status cadence. | Independent 6-second status polling and an 8-second guard. RPC failures cover rather than continuing a live fire. Pure guard tests and failure browser scenario pass. |
| Medium / writing | `src/App.tsx:435`: one connection failure appeared in both the live-region feedback and persistent connection notice. Initial taste repetition check failed. | Replaced live-region copy with a short historical-cache availability message; retained one detailed retry notice. Final probe: no repeated lines. |
| Medium / UI | `src/Bench.tsx:14`: repeated SVG gradient IDs could make a cold shelf/modal inherit the active bench material. | Unique React IDs per `PieceArt`. Finished 1212 screenshot shows cold metal with its stamped mark. |
| Medium / layout | `src/Bench.tsx:20`: unbounded count-based height could push the billet outside its scene during a long live fire. | Bounded count/Temper visual range and at most 16 visible hammer marks. Full official record remains in the detail list. Historical eight-shape check and source bounds verified. |
| Medium / accessibility | `src/style.css:486`: the desktop secondary action had a 36px override. Notes source links were ordinary short inline links. | Secondary targets raised to 44px; source links use a 44px inline-flex hit area. Final mobile probe reports zero controls below 44px. |
| Medium / task clarity | `src/App.tsx:207`, `:497`: rests were initially only available in a disclosure. | Rest gaps between the chosen official blows are also visibly labelled `0 work · rest` below the timeline. Full certified rest list remains expandable. |
| Medium / packaging | `.gitignore:8`: inherited ignores excluded named `artifacts/**` files from the submission candidate list. | Explicit delivery negations added within the documented 1KiB ignore-file budget. Final path/byte check includes covers, screenshots, licenses and validation files. |
| Low / UI | `src/App.tsx:104`: failed Clipboard API access only told the visitor to select a hidden link. | Added native text-copy fallback, automatic disclosure of the link on failure, and verified exact successful clipboard share in Chromium. |

The browser harness initially had a locator that searched exact text on a lamp containing a refresh button. That was a validation-scaffold error, corrected to inspect the labelled lamp container; it was not a product defect. No failed check was reclassified as a pass without a fix or a stated limitation.

## Actual execution

| Command / action | Actual result |
| --- | --- |
| `npm install` | Completed; source manifest and lockfile retained, generated dependencies excluded. |
| `npm run typecheck` | Passed (`tsc --noEmit`). Also runs as part of every production build. |
| `npm test` | Passed: 4 formula and 14 protocol/game tests; **18 total**, no failures/skips. Revision added a dead-fire `resumeLive` test. |
| `npm run build` | Passed after final source change. Vite exported relative URLs; main JS ~237kB before gzip, CSS ~19.5kB; fonts stay in the local `fonts/` path. |
| `node --import tsx scripts/capture.ts` | Actual public Sepolia `eth_call` reads: configuration, state, two historical pages and single 1212 page. Frontier 1248, 23 active records; raw results in delivered certified cache. |
| `npm run recompute -- 1212` and `-- --snapshot 1212` | Both returned Mass 80, Heart deb98f44, Temper 1 steered / 0 light, Grain 9769. The offline path reuses actual certified cached pages. |
| `npm run check:browser` | Exit 0 with explicit WebKit limitation. Chromium: historical eight strikes with eight distinct geometries, quench, full record, matching recompute, exact clipboard hash, local shelf persistence, shared 1212, invalid hash rejection, keyboard Enter/Tab/Escape/focus return. Also live lighting, zero-blow disabled quench, actual captured 1212 auto strike, cover/resume, pause, idle death, live frontiers and as-is quench; simultaneous API/RPC failure remains playable from certified cache. |
| Pinned `taste.mjs --out test/scratch/taste-final` | Exit 0; **16/16 checks passed**. Production 390/1440 screenshots viewed; 320 reflow and reduced motion included by probe. No script errors or missing local files. |
| `npm run check:export` | Passed cover dimensions/size, relative HTML/CSS assets, ABI parity, no packaged caches/archives and candidate submission under **8,388,608 bytes**. Exact final measurements in `bundle-budget.json`. |
| Supplied browser MCP | Failed to launch: singleton socket path too long. A separately launched Playwright Chromium session performed the rendered checks; no MCP observation is claimed. |
| WebKit / native dependencies | Downloaded browser, but launch failed due to missing shared libraries. Local dependency installation attempt could not use the absent package database. **Not verified in WebKit/Safari**. |
| Actual public API / full ABI / official Code | API and direct ABI reads returned access/unavailable responses; Code/ramp fetch could not complete. Actual live status remains unknown; no real settlement transaction or real spinning observation is claimed. Read-only ABI scope and sampled-colour cover preview are disclosed. |

The browser validation script owns a temporary static server under `/preview/` and closes it at completion. No backend is part of the export. Browser fixtures contain real captured round work/hashes and simulated control states, not fabricated gameplay data. Screenshot artifacts contain only this task’s public data.

## Evidence delivered

- `taste.json`: actual final probe checks (16 passed).
- `interaction-results.json`: actual final bounded browser report, including WebKit limitation.
- `screenshots/first-screen-390.png`, `first-screen-1440.png`: real production export with cached official data and an unknown lamp during service failure.
- `screenshots/keyboard-focus-390.png`: primary action keyboard focus.
- `screenshots/official-1212-390.png`: visible deb98f44 mark and exact traits in the piece dialog.
- `screenshots/live-covered-390.png`: live cover state with its certified blow retained.
- `headline-image.png`, `headline-image.led-preview.png`: cover and inspected 64×36-derived preview.
- `bundle-budget.json`: final tracked-candidate/export byte budget, excluding scratch and dependencies.

Completion: **the usable game, production export and requested documentation are delivered and locally checked; exact official-ramp equivalence and full published-ABI byte parity remain unverified source limitations.** Public hosting/repository publication is after review. No full accessibility, Safari or independent verifier behavioral pass is asserted.

## Revision: reviewer findings (2026-11-12)

Each finding was reproduced first. The four behavioural scenarios were added to `scripts/validate-browser.mjs` and run against a build of the **pre-revision** source (with only the stale-close fix below applied); all four failed there, and all four pass on the revised source.

| Finding | Reproduced on old build | Cause and fix |
| --- | --- | --- |
| Historical piece cannot be quenched after one blow | Yes: no Quench control after striking 1198 (click timed out). | `src/useWorkshop.ts` `quench()` refused 1–7 historical blows. Now any fire with ≥1 blow quenches; `src/App.tsx` shows **Quench to shelf** beside the next strike and **Abandon fire**. Zero blows still cannot quench. |
| Status refresh awards rounds certified while covered | Yes: phase read `burning` 1.4 s after the lamp returned, before the delayed `state()`. | The 650 ms guard resumed covered fires. It may now only cover or kill. A covered fire resumes only in `sync()` through `resumeLive()`, from a `state()` read that began after the spinning lamp was observed (re-read if the lamp arrived later). Round 1212, certified while covered, stays unawarded (0 blows). |
| RPC failure resurrects a fire killed by IDLE | Yes: dead fire turned covered, then burning. | The failed-read and hidden-tab paths now cover only a **burning** fire; `resumeLive()` returns a dead fire unchanged. The fire stays dead with 0 blows until abandoned; a new lighting then records a new frontier. |
| Valid shared pieces stay rejected | Yes: the 1212 link stayed rejected after the 1212 frontier arrived; the 1198 link never opened after Refresh. | A hash is marked done only after it opens or is definitively invalid (malformed, or a certified rest). Beyond-frontier is not final: it retries when the frontier changes. Failed reads retry on the next successful contract read or **Refresh official data**. |
| LED preview not nearest-neighbour | Yes: 1048 of 2304 aligned 16×16 blocks held several colours (8-bit palette with dithering). | Regenerated: 64×36 area-sampled grid first, then ×16 nearest-neighbour, 24-bit RGB, no dithering. 0 non-uniform blocks. Public, `dist/` and `artifacts/` copies replaced; inspected and still readable (centred anvil and workpiece, ember fire, bench). |

The browser run found one more defect while testing the shared-link fix, and it also fails on the old code. When a piece dialog is closed and another piece opens right away, Chrome fires the earlier `close` event late, and that event dismissed the new dialog. `onClose` in `src/App.tsx` now clears the piece only when the dialog is actually closed.

Revision commands: `npm test` (18 passed), `npm run typecheck` (passed), `npm run build` (passed), `CHROMIUM_PATH=<local headless Chromium> node scripts/validate-browser.mjs` (Chromium passed every scenario; WebKit could not launch here: missing browser build), pinned `taste.mjs --out test/scratch/taste` (**16/16 passed**, 390 first screen viewed: bench and **Forge historical piece** visible), `npm run check:export` (passed). The one-blow bench state was screenshotted at 390. Both secondary buttons measured 44 px and the page had no horizontal overflow. The Better Interface review of the new control: it reuses the existing `.quiet` secondary style and verb-first copy, keeps a single primary action, and needs no new tokens.
