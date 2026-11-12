# Wheelwright design system

## Overview

Wheelwright is a compact atelier for the Squeekchain community. A dark steel bench, copper controls and a visibly stamped iron billet carry the identity. The playable product is the first screen; there is no marketing hero before it. The industrial condensed title and original SVG tools provide the stamped-metal character without a letterpress serif or a dashboard layout.

The implementation lives in `src/style.css`, `src/Bench.tsx` and `src/App.tsx`. The site supports one English, dark appearance. The separately generated cover depicts the same subject with broad poster silhouettes; it is not the gameplay surface.

## Colors

Canonical tokens are in `src/style.css:22`. Components use these semantic roles:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#171d19` | Page and outer workshop |
| `--surface` | `#212820` | Bench control surface, modal, connection notice |
| `--scene` | `#1b231d` | Recessed bench and shelf art |
| `--raised` | `#2b3329` | Neutral hover |
| `--line` | `#444d3e` | Structural dividers and controls |
| `--text` | `#eee8d5` | Warm ivory primary text |
| `--muted` | `#acb19f` | Supporting copy and unknown lamp |
| `--accent` | `#e8a575` | Copper primary action, historical progress |
| `--accent-hover` | `#f3bd94` | Primary hover |
| `--accent-ink` | `#231f17` | Text on copper |
| `--focus` | `#f3d5a0` | 2px keyboard focus outline, 4px offset |
| `--online` | `#b6c89d` | Certified check and spinning lamp |

The measured token pairs are primary text/page **13.98:1**, muted/page **7.78:1**, primary text/surface **12.34:1**, muted/surface **6.87:1**, muted/scene **7.31:1**, and accent ink/copper **7.87:1**. These values were calculated from the implemented sRGB values, and the rendered probe passed its measured solid-background text checks. SVG artwork gradients and small decorative labels are not claimed to have a complete contrast audit.

Status always includes words. The unknown lamp is hollow; spinning is filled green; idle is filled neutral. Paused is named explicitly. Colour alone never authorizes a live fire.

## Typography

All three font files are local under `public/fonts/`; their SIL licenses are adjacent. CSS uses root-relative public references which Vite rewrites for the relative static export. There are no font CDN requests.

- `--font`: **Barlow**, `system-ui`, `sans-serif`, with local regular **400** and semibold **600**.
- `--display`: **Barlow Condensed**, `Impact`, `sans-serif`, local bold **700** for the title and section headings.
- `--mono`: `ui-monospace`, `Cascadia Code`, `Liberation Mono`, `monospace`, for hashes and official numbers. Prose stays in Barlow.

The six-step scale is **12, 14, 16, 20, 28, 56px**. At 720px and narrower, the display step becomes **40px**. H1 is 56/40px, section H2 is 28px, content H3 is 20px, primary controls/body are 16px, support copy is 14px, and short captions are 12px. Bench toolbar headings deliberately use the body role. Weights are limited to 400, 600 and 700.

H1 has `-.025em` tracking and `1.1` line-height; body copy uses `1.5`, controls `1.4`, and compact headings `1.1–1.25`. Text stays selectable. Hashes wrap anywhere and are also copyable; official values are never ellipsized. Numeric values use tabular figures. Inputs remain 16px on phones. The rendered probe confirms the three families and six sizes; it is not a screen-reader or text-zoom audit.

## Layout

`.atelier` is capped at **1280px**, centred with **48px** horizontal padding and **32px** top padding. The spacing vocabulary is primarily multiples of 4: 8/12px within groups, 16/20/24/28px within surfaces, and 32/40/44/48px between larger regions. The smallest viewport has a deliberate 14px outer inset.

- `.masthead`: wordmark at the leading edge, utilities at the trailing edge. The exact tagline follows once.
- `.bench-grid`: scene and control panel in a **1.9fr / 1fr** split, with a 300px minimum control column. At 1000px the split becomes **1.3fr / 1fr**, with a 290px control minimum.
- At **720px**, the bench stacks scene over controls. The scene uses a **1.55** aspect ratio; padding becomes 20px; the direct Shelf utility remains in the header. The bench and primary action fit within the observed **390×844** first screen.
- At **1000px**, outer padding is 28px; at **720px**, 20px; below **360px**, 14px.
- `.underbench` has two columns on desktop and stacks below 720px. Trait values keep a two-column definition list. The round list is a four-column compact timeline; certified rests between the selected rounds are visible beneath it and the full certified rest list is expandable.
- `.shelf-grid` is three columns on desktop, two on phones. Empty shelf copy names the action that fills it.
- `.notes-grid` is two columns on desktop and one on phones. Bench notes use native disclosure; the page does not grow a separate static route.

The production export was inspected at 320, 390, 720, 1000 and 1440px without horizontal overflow. Native 200% zoom, RTL layout and physical phones were not verified.

## Elevation & Depth

Flat tonal layers and structural borders define the bench. There are no component box shadows, nested card stacks, glass effects or gradient text. The scene’s grid and the iron/wood gradients belong to the illustration, not the UI surface system.

The native modal dialog is the only top layer. Its dark `#0a100be6` backdrop separates a finished piece from the inactive bench. It uses a one-pixel structural outline and its own internal scroll, with `overscroll-behavior: contain`.

## Shapes

Buttons and fields have **3px** corners, the bench **4px**, and the dialog **5px**. Small square progress marks and a diamond historical-fire indicator support the stamped-metal direction. The main action uses a solid copper fill; peer actions remain neutral. No pill navigation or small tracked capitals are used.

The workpiece is an irregular bevelled billet defined by `PieceArt`. Its width comes from bigint Mass modulo a bounded visual range; height and hammer marks use the blow count, Temper and Heart. The eight hexadecimal Heart characters are drawn directly on its face. The shape remains bounded during long live fires. SVG gradient IDs use React `useId` so the bench, modal and shelf do not accidentally share material definitions.

## Components

| Component/pattern | Source | Behaviour and states |
| --- | --- | --- |
| `Bench` | `src/Bench.tsx:80` | Original SVG bench, forge, anvil, hammer and bucket. Hot historical/live work, covered live fire, unstruck iron and a visible smith’s mark. No invented strikes. |
| `PieceArt` | `src/Bench.tsx:3` | Reused deterministic metal for the bench, cold shelf and detail modal; receives authoritative traits and blow count. |
| Primary/quiet buttons | `src/style.css:441`, `.quiet` | One copper primary per active view; hover, native disabled, press and visible keyboard focus. Minimum targets are 44px; primary is 52px desktop / 48px phone. During a part-worked historical fire the secondary row holds **Quench to shelf** and **Abandon fire** as quiet buttons beside the copper next-strike action. |
| Lamp | `src/App.tsx`, `.lamp` | Unknown, idle, spinning and explicit paused wording. Refresh is a named native button. Availability and pause remain independent inputs. |
| `TraitList` | `src/App.tsx` | Semantic `dl` for Mass, Heart, Temper and Grain. Empty iron uses a neutral dot. The Grain label retains the full official field name. |
| Official timeline | `src/App.tsx`, `.round-timeline`, `.visible-rests` | Increasing official IDs, work, struck check marks and labelled zero-work rests. No RPM or furnace chart. |
| Shelf | `src/App.tsx`, `.shelf-grid` | Browser-local collection, useful empty state, native buttons to open every record. No global ownership claim. |
| Piece dialog | `src/App.tsx`, `.piece-dialog` | Native modal focus containment, Escape/close, focus restoration, every official record, copy actions, exact share and recompute. Failed clipboard access has a text-copy fallback and a visible link. |
| Bench notes | `src/App.tsx`, `.bench-notes` | Native summary/details for rules, sources, 1212 check, custom Sepolia fallback and optional transaction list. |
| Status feedback | `src/App.tsx` | Stable polite live region for strikes, copy/retry and share errors; persistent connection notices are separate and do not duplicate it. |

Application state belongs in `useWorkshop`; protocol authorization belongs in `src/game.ts`, `src/api.ts` and `src/protocol.ts`. Styling never changes what qualifies as an official blow. Only certification changes the game’s data.

Strike motion is a single **480ms** hammer/workpiece sequence with **500ms** sparks. It is inside `prefers-reduced-motion: no-preference`; reduced motion still has the changed geometry, count and text record. Button feedback names only background colour and transform, lasts **150ms**, and presses to **0.96**. There is no endless animation.

## Do’s and don’ts

- Reuse `.atelier`, `.section-heading`, the six type steps and the primary/quiet control patterns for another workshop view.
- Keep the bench and its action above explanatory content at phone widths.
- Use copper to identify the primary action and the metal’s transformation; keep status labelled in text.
- Retain full official values and make them copyable. Use the one shared formula implementation for every displayed piece.
- Keep future additions inside the same one-page static export unless every route is explicitly exported.
- Keep unknown state unknown. A visual effect must never manufacture a blow or a spinning lamp.
- Preserve local fonts and the condensed industrial title; do not introduce a serif, font CDN, wallet stack, charting surface or decorative card hierarchy.

The official Code ramp was unreachable; the cover preview is a documented sampled-colour preview, not a claimed official-palette verification. See `artifacts/validation.md` for evidence and coverage limits.
