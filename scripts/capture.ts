// Maintainer read-only snapshot capture. curl honors the contributor's network transport.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  CoreReader,
  SELECTORS,
  RPCS,
  PROXY,
  validateConfiguration,
} from "../src/protocol";
const rpc = async (method: string, params: unknown[]) => {
  const raw = execFileSync(
    "curl",
    [
      "-fsS",
      "--max-time",
      "20",
      "-H",
      "Content-Type: application/json",
      "--data",
      JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      RPCS[0],
    ],
    { encoding: "utf8" },
  );
  const body = JSON.parse(raw);
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result as string;
};
const reader = new CoreReader(undefined, rpc);
if (BigInt(await rpc("eth_chainId", [])) !== 11155111n)
  throw new Error("Not Sepolia");
const rawConfiguration = await reader.call(SELECTORS.configuration);
validateConfiguration(rawConfiguration);
const rawState = await reader.call(SELECTORS.state),
  state = await reader.state();
const h = await reader.historical(state.frontier);
const check = await reader.span(1211n, 1212n, state.frontier);
writeFileSync(
  "public/certified-history.json",
  JSON.stringify(
    {
      version: 1,
      proxy: PROXY,
      chain: "11155111",
      capturedAt: new Date().toISOString(),
      source: RPCS[0],
      rawConfiguration,
      rawState,
      pages: h.pages,
      check1212: check.pages,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    frontier: state.frontier.toString(),
    pages: h.pages.length,
    active: h.blows.length,
    newest: h.newest,
    check: check.blows,
  }),
);
