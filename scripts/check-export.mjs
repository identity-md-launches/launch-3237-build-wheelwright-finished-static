import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const html = await readFile("dist/index.html", "utf8");
assert.match(html, /<title>Wheelwright: no spin, no fire<\/title>/);
for (const key of ["description", "og:title", "og:image"])
  assert.ok(html.includes(`"${key}"`));
for (const ref of [
  ...html.matchAll(/(?:href|src|content)="([^"<>]+\.(?:js|css|ttf|svg|png))"/g),
].map((m) => m[1])) {
  assert.ok(ref.startsWith("./"), `Nonrelative HTML asset ${ref}`);
  await stat(path.join("dist", ref));
}
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    assert.ok(
      !["node_modules", ".cache", ".npm", ".vite"].includes(e.name),
      `Generated directory in export: ${p}`,
    );
    if (e.isDirectory()) await walk(p);
    else {
      assert.ok(
        !/\.(?:tgz|zip|map)$/.test(p),
        `Unnecessary packaging asset: ${p}`,
      );
      files.push({ path: p, bytes: (await stat(p)).size });
    }
  }
}
await walk("dist");
for (const f of files.filter((f) => f.path.endsWith(".css"))) {
  const css = await readFile(f.path, "utf8");
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
    const ref = m[1].replace(/["']/g, "");
    if (ref.startsWith("data:")) continue;
    assert.ok(!ref.includes("://"), "External CSS asset");
    await stat(path.resolve(path.dirname(f.path), ref));
  }
}
const png = await readFile("dist/headline-image.png");
assert.equal(png.subarray(1, 4).toString(), "PNG");
assert.equal(png.readUInt32BE(16), 1920);
assert.equal(png.readUInt32BE(20), 1080);
assert.ok(png.length < 4000000);
const preview = await readFile("dist/headline-image.led-preview.png");
assert.equal(preview.readUInt32BE(16), 1024);
assert.equal(preview.readUInt32BE(20), 576);
assert.deepEqual(
  await readFile("abi/SqueekCore.json"),
  await readFile("dist/abi/SqueekCore.json"),
);
const listed = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((p) => !p.startsWith(".imd/") && !p.startsWith("test/scratch/"));
let bytes = 0;
const byRoot = {};
for (const p of listed) {
  const size = (await stat(p)).size;
  bytes += size;
  const root = p.includes("/") ? p.split("/")[0] + "/" : p;
  byRoot[root] = (byRoot[root] ?? 0) + size;
  assert.ok(!p.split("/").includes("node_modules"));
  assert.ok(!/\.(?:tgz|zip)$/.test(p));
}
assert.ok(bytes <= 8388608, `Submission exceeds budget: ${bytes}`);
const result = {
  exportFiles: files.length,
  exportBytes: files.reduce((sum, f) => sum + f.bytes, 0),
  submissionBytes: bytes,
  limit: 8388608,
  byRoot,
};
await mkdir("test/scratch", { recursive: true });
await writeFile(
  "test/scratch/export-budget.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
