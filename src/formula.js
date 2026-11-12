/** The only trait formula, shared by the bench, shelf, CLI and frozen test. */
export async function traits(blows) {
  if (!blows.length)
    throw new Error("A piece needs at least one official blow.");
  let previous = -1n,
    mass = 0n,
    steered = 0n,
    light = 0n;
  const lines = blows.map((b) => {
    const id = BigInt(b.roundId),
      work = BigInt(b.work);
    if (
      id <= previous ||
      work <= 0n ||
      work > 10000n ||
      !/^0x[0-9a-fA-F]{64}$/.test(b.dataHash) ||
      /^0x0{64}$/i.test(b.dataHash)
    )
      throw new Error("Invalid official blow or order.");
    previous = id;
    mass += work;
    if (work >= 40n) steered++;
    else light++;
    return `${id}:${b.dataHash.toLowerCase()}`;
  });
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(lines.join("\n")),
  );
  const heart = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 8);
  const grain = BigInt(blows.at(-1).workPerThousandBlocks);
  if (grain < 1n) throw new Error("Invalid official difficulty.");
  return {
    mass: mass.toString(),
    heart,
    temper: `${steered} steered / ${light} light`,
    grain: grain.toString(),
    steered: steered.toString(),
    light: light.toString(),
  };
}
