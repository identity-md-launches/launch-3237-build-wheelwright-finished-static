import { useId } from "react";
import type { Traits } from "./formula";
export function PieceArt({
  value,
  count = 0,
  cold = false,
  small = false,
}: {
  value: Traits | null;
  count?: number;
  cold?: boolean;
  small?: boolean;
}) {
  const gradientId = useId();
  const seed = value ? parseInt(value.heart, 16) : 0;
  const mass = BigInt(value?.mass ?? "0");
  const width = 128 + Number(mass % 53n),
    h =
      46 +
      (count % 9) * 3 +
      Number(BigInt(value?.steered ?? "0") % 9n) +
      (seed % 19);
  const y = 250 - h;
  const corners = `${320 - width},${y + 12} ${320 - width + 18},${y} ${320 + width - 16},${y + (seed % 8)} ${320 + width},${y + 15} ${320 + width - 9},249 ${320 - width + 12},249`;
  const marks = Array.from({ length: Math.min(count, 16) }, (_, i) => ({
    x: 320 - width + 23 + ((i * 37 + (seed >>> i % 16)) % (width * 2 - 45)),
    y: y + 15 + ((i * 13 + (seed % 17)) % Math.max(8, h - 25)),
  }));
  return (
    <g className="metal-piece">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
          <stop stopColor={cold ? "#b5bab6" : count ? "#ffd19b" : "#737c79"} />
          <stop
            offset=".4"
            stopColor={cold ? "#6b7c7c" : count ? "#d6844f" : "#46514e"}
          />
          <stop
            offset="1"
            stopColor={cold ? "#364342" : count ? "#7f4930" : "#293330"}
          />
        </linearGradient>
      </defs>
      <polygon
        points={corners}
        fill={`url(#${gradientId})`}
        stroke={cold ? "#d7e1da" : count ? "#f9bf85" : "#8a9791"}
        strokeWidth="2"
      />
      <path
        d={`M${320 - width + 18} ${y + 7}L${320 + width - 20} ${y + 8}`}
        stroke="#f4d1aa"
        opacity=".7"
        strokeWidth="2"
      />
      {marks.map((m, i) => (
        <path
          key={i}
          d={`M${m.x} ${m.y}l10 -4m-8 7l13 -5`}
          stroke={cold ? "#2b3936" : "#573c2b"}
          strokeWidth="3"
          opacity=".7"
        />
      ))}
      {value && (
        <text
          x="320"
          y={y + h * 0.66}
          textAnchor="middle"
          fill={cold ? "#e1e6d9" : "#30281e"}
          className="smith-mark"
          fontSize="22"
        >
          {value.heart}
        </text>
      )}
    </g>
  );
}
export function Bench({
  value,
  count,
  phase,
  historical,
  strikeKey,
}: {
  value: Traits | null;
  count: number;
  phase: string;
  historical: boolean;
  strikeKey: number;
}) {
  const hot = historical ? count > 0 : phase === "burning";
  return (
    <div
      className={`bench-scene ${hot ? "hot" : ""} ${phase === "covered" ? "covered" : ""}`}
    >
      <div className="scene-top">
        <span>
          <i className="scene-square" />
          Bench 01
        </span>
        <span>Sepolia / hand-finished</span>
      </div>
      <svg
        className="workshop-art"
        viewBox="0 0 800 460"
        role="img"
        aria-label={
          count
            ? `Forged metal on the anvil. Smith’s mark ${value?.heart ?? "being computed"}. ${count} official blows.`
            : "A heavy steel anvil on a workbench, with a hammer, tongs and quenching bucket."
        }
      >
        <defs>
          <linearGradient id="iron" x1="0" y1="0" x2="0.4" y2="1">
            <stop stopColor="#717874" />
            <stop offset=".14" stopColor="#414c47" />
            <stop offset=".5" stopColor="#242e2b" />
            <stop offset="1" stopColor="#161e1c" />
          </linearGradient>
          <linearGradient id="bench" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#52483b" />
            <stop offset=".1" stopColor="#2e2b25" />
            <stop offset="1" stopColor="#171b17" />
          </linearGradient>
          <radialGradient id="embers">
            <stop stopColor="#ed9854" stopOpacity={hot ? ".32" : "0"} />
            <stop offset="1" stopColor="#d36a34" stopOpacity="0" />
          </radialGradient>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M40 0H0V40"
              fill="none"
              stroke="#66736a"
              strokeOpacity=".11"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="800" height="460" fill="url(#grid)" />
        <ellipse cx="365" cy="245" rx="265" ry="185" fill="url(#embers)" />
        <g fill="none" stroke="#66736a" strokeOpacity=".25">
          <path d="M42 68v-15h15m686 0h15v15M42 375v15h15m686 0h15v-15" />
          <path d="M67 388H725M68 385v6m657-6v6" />
          <path d="M56 128h60m-30-30v60M697 261h45m-23-22v45" />
        </g>
        <g
          className="tool-rack"
          stroke="#68736a"
          strokeWidth="3"
          opacity=".5"
          fill="none"
        >
          <path d="M609 60v73m-9-73h18m-23 77h30l-8-8h-13zM657 70l-17 68m5-69l12 1 10 7m-31 63 12 3M692 72l-12 67m15-64-15-4m-5 66-7 11m11-10 3 11" />
          <path d="M582 49h141" />
        </g>
        <g className="forge">
          <path
            d="M94 238h104l-15 61h-76z"
            fill="#252c26"
            stroke="#6b6e5d"
            strokeWidth="2"
          />
          <path d="M102 235h87" stroke="#c28d58" strokeWidth="6" />
          <path
            d="M109 302l-10 45m76-45 11 45"
            stroke="#616457"
            strokeWidth="6"
          />
          {hot && phase !== "covered" && (
            <g fill="#f1b06b">
              <path
                d="M113 231c-17-22 10-31 3-50 25 19 4 22 24 37-5-30 17-39 12-62 36 35 0 41 21 61 2-16 12-15 14-30 20 29-1 38-1 44z"
                fill="#bc683d"
              />
              <path d="M125 231c-13-15 13-18 6-33 21 11 8 20 18 23-1-10 11-18 10-30 18 18 9 25 15 40z" />
              <path d="M130 234l26-14 17 14" fill="#ffe0a3" />
            </g>
          )}
          {phase === "covered" && (
            <path d="M91 227h112v12H91z" fill="#879183" stroke="#c5c6aa" />
          )}
        </g>
        <ellipse
          cx="407"
          cy="375"
          rx="230"
          ry="25"
          fill="#101611"
          opacity=".8"
        />
        <g className="heavy-bench">
          <path
            d="M171 310l446-10 29 28-466 13z"
            fill="#71634e"
            stroke="#8b7d60"
          />
          <path
            d="M180 341l466-13v25l-466 12z"
            fill="url(#bench)"
            stroke="#6e6451"
          />
          <path
            d="M209 362h35l-7 65h-29zm360-10h34l14 65h-29z"
            fill="#2b2d24"
            stroke="#655d48"
            strokeWidth="2"
          />
          <path d="M240 387l347-7" stroke="#4d4c3b" strokeWidth="12" />
          <path
            d="M222 369l-1 47m375-58 8 47"
            stroke="#151d17"
            strokeWidth="4"
          />
          <g fill="#a79873">
            <circle cx="200" cy="350" r="3" />
            <circle cx="623" cy="340" r="3" />
          </g>
        </g>
        <g transform="translate(80 0)">
          <g className="anvil">
            <path
              d="M114 254l65 31 49 3 19 13-12 22h157l-20-23 17-18 58-7 32-29-78 2-1-12H229l-7 14z"
              fill="url(#iron)"
              stroke="#78847a"
              strokeWidth="1.5"
            />
            <path
              d="M115 254l106 6 11-15h167l4 8 75-7"
              fill="none"
              stroke="#a3aba0"
              strokeWidth="3"
            />
            <path d="M235 322h154l-15-20H247z" fill="#3f4b41" />
            <path
              d="M250 287l117-8m-114 8 9 16m89-19-7 18"
              stroke="#121d17"
              strokeWidth="2"
            />
            <path d="M255 311h113" stroke="#9a9e85" opacity=".4" />
          </g>
          <g key={strikeKey} className={count ? "strike-workpiece" : ""}>
            <PieceArt value={value} count={count} />
          </g>
          <g
            key={`hammer-${strikeKey}`}
            className={count ? "hammer struck" : "hammer"}
          >
            <path d="M381 177l100-112" stroke="#302d22" strokeWidth="21" />
            <path d="M380 174L480 64" stroke="#9a8060" strokeWidth="12" />
            <path d="M379 177l72-81" stroke="#b49a72" strokeWidth="3" />
            <path
              d="M424 50l28-31 76 65-27 32z"
              fill="#3c4742"
              stroke="#9ba396"
              strokeWidth="2"
            />
            <path d="M424 50l30-21 74 55-27 21z" fill="#6a7369" />
            <path d="M424 50l1 13 73 62 3-20" fill="#222e26" />
            <path d="M448 42l57 49" stroke="#9ba396" strokeWidth="2" />
          </g>
          {count > 0 && (
            <g
              key={`sparks-${strikeKey}`}
              className="strike-sparks"
              stroke="#f8bf7a"
              strokeWidth="3"
            >
              <path d="M230 207l-20-17m8 46-29 3m201-40 23-20m-8 50 24 10m-89-79 5-25" />
            </g>
          )}
        </g>
        <g className="quench-bucket">
          <path
            d="M649 322l11 76c17 11 48 10 64-2l10-75"
            fill="#27332e"
            stroke="#778277"
            strokeWidth="2"
          />
          <ellipse
            cx="692"
            cy="323"
            rx="42"
            ry="11"
            fill="#566e63"
            stroke="#9ca896"
            strokeWidth="2"
          />
          <path
            d="M658 316c-10-53 77-54 71 0"
            fill="none"
            stroke="#69776a"
            strokeWidth="3"
          />
          <path d="M669 338l8 48m39-49-8 49" stroke="#657464" opacity=".7" />
          <path d="M674 319l26-2m-11 9h21" stroke="#a6b6a1" strokeWidth="2" />
        </g>
        <g fill="#7d897b" fontFamily="monospace" fontSize="11">
          <text x="70" y="419">
            W / 01
          </text>
          <text x="700" y="419">
            600s
          </text>
        </g>
      </svg>
      <div className="scene-bottom">
        <span className="scene-caption">
          {count
            ? `Smith’s mark / ${value?.heart ?? "stamping…"}`
            : "Raw iron. Official possibilities."}
        </span>
        <span>
          {phase === "covered"
            ? "Fire covered"
            : count
              ? `${count} official ${count === 1 ? "blow" : "blows"}`
              : "Ready at the anvil"}
        </span>
      </div>
    </div>
  );
}
