import { makeSeed } from "@/lib/world/seed";

/** Neuer Seed aus der Zufallsquelle des Browsers («Welt neu würfeln»). */
export function randomSeed(): string {
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  let i = 0;
  return makeSeed(() => buf[i++] / 2 ** 32);
}
