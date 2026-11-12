import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { CoreReader, decodeState, RPCS, PROXY } from "../src/protocol";
import { traits } from "../src/formula.js";
const args = process.argv.slice(2),
  snapshot = args.includes("--snapshot");
const ids = args.filter((x) => x !== "--snapshot");
if (!ids.length) ids.push("1212");
if (
  ids.some(
    (id, i) =>
      !/^\d+$/.test(id) ||
      BigInt(id) <= 0n ||
      (i > 0 && BigInt(id) <= BigInt(ids[i - 1])),
  )
)
  throw new Error("Give increasing positive official round IDs.");
const seed = JSON.parse(readFileSync("public/certified-history.json", "utf8"));
const rpc = async (method: string, params: unknown[]) => {
  for (const endpoint of RPCS) {
    try {
      const body = JSON.parse(
        execFileSync(
          "curl",
          [
            "-fsS",
            "--max-time",
            "15",
            "-H",
            "Content-Type: application/json",
            "--data",
            JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
            endpoint,
          ],
          { encoding: "utf8" },
        ),
      );
      if (body.error || typeof body.result !== "string") continue;
      return body.result;
    } catch {
      /* next Sepolia provider */
    }
  }
  throw new Error(
    "Sepolia RPC reads unavailable. Use --snapshot for the bundled certified span.",
  );
};
const reader = new CoreReader(
  undefined,
  snapshot
    ? async () => {
        throw new Error("Round not in the certified snapshot. Retry online.");
      }
    : rpc,
);
reader.seed([...seed.pages, ...seed.check1212]);
if (!snapshot && BigInt(await rpc("eth_chainId", [])) !== 11155111n)
  throw new Error("Not Sepolia");
const state = snapshot ? decodeState(seed.rawState) : await reader.state(),
  blows = await reader.resolve(ids, state.frontier);
console.log(
  JSON.stringify(
    {
      chain: "11155111",
      proxy: PROXY,
      source: snapshot
        ? "bundled certified roundPage cache"
        : "SqueekCore roundPage",
      blows,
      traits: await traits(blows),
    },
    null,
    2,
  ),
);
