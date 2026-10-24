import { beforeEach, describe, expect, it, vi } from "vitest";

// Ohne Datenbank: Sitzung und Supabase sind Fakes, die jede Abfrage mitschreiben.
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  bulkDelete,
  bulkMoveArtifacts,
  bulkSetKind,
  bulkSetVisibility,
  reorderArtifacts,
} from "./inventar-actions";

const USER = "user-1";
const A = "6f1c2c1e-6f1c-4c1e-8f1c-2c1e6f1c2c1e";
const B = "7a2d3d2f-7a2d-4d2f-9a2d-3d2f7a2d3d2f";
const HOUSE = "8b3e4e30-8b3e-4e30-8b3e-4e308b3e4e30";

type Call = { table: string; op: string; args: unknown[] };

/** Supabase-Fake: merkt sich Tabelle, Operationen und Filter; `owns` steuert die Hausprüfung. */
function fakeDb(owns = true) {
  const calls: Call[] = [];
  const builder = (table: string) => {
    const call: Call = { table, op: "", args: [] };
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "update", "delete", "in", "eq"]) {
      chain[m] = (...args: unknown[]) => {
        if (m === "update" || m === "delete") call.op = m;
        call.args.push([m, ...args]);
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: owns ? { id: HOUSE } : null });
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [{ id: A }, { id: B }], error: null });
    return chain;
  };
  return { db: { from: builder }, calls };
}

beforeEach(() => {
  mocks.requireUser.mockReset();
  mocks.revalidatePath.mockReset();
});

const filters = (c: Call) =>
  c.args.filter((a) => (a as unknown[])[0] === "eq" || (a as unknown[])[0] === "in");

describe("Massenaktionen", () => {
  it("prüfen die Eingabe mit Zod (Ids, Kategorie, Sichtbarkeit, Anzahl)", async () => {
    expect(await bulkSetKind({ ids: [A], kind: "kaffee" })).toHaveProperty("error");
    expect(await bulkSetVisibility({ ids: [A], visibility: "alle" })).toHaveProperty("error");
    expect(await bulkDelete({ ids: [] })).toEqual({ error: "Keine Objekte gewählt." });
    expect(await bulkDelete({ ids: ["x"] })).toHaveProperty("error");
    const many = Array.from({ length: 201 }, () => A);
    expect(await bulkDelete({ ids: many })).toEqual({ error: "Höchstens 200 Objekte auf einmal." });
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("filtern immer zusätzlich nach owner_id", async () => {
    const { db, calls } = fakeDb();
    mocks.requireUser.mockResolvedValue({ supabase: db, user: { id: USER } });
    expect(await bulkSetKind({ ids: [A, B], kind: "quiz" })).toEqual({ ok: true, count: 2 });
    expect(await bulkDelete({ ids: [A, B] })).toEqual({ ok: true, count: 2 });
    expect(await bulkSetVisibility({ ids: [A], visibility: "private" })).toEqual({
      ok: true,
      count: 2,
    });
    for (const c of calls.filter((x) => x.table === "artifacts")) {
      expect(filters(c)).toContainEqual(["eq", "owner_id", USER]);
    }
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("Freigeben lässt Übernahmen privat", async () => {
    const { db, calls } = fakeDb();
    mocks.requireUser.mockResolvedValue({ supabase: db, user: { id: USER } });
    await bulkSetVisibility({ ids: [A], visibility: "shared" });
    expect(filters(calls[0])).toContainEqual(["eq", "is_copy", false]);
  });

  it("verschieben und umsortieren nur in eigene Häuser", async () => {
    const foreign = fakeDb(false);
    mocks.requireUser.mockResolvedValue({ supabase: foreign.db, user: { id: USER } });
    expect(await bulkMoveArtifacts({ ids: [A], houseId: HOUSE })).toEqual({
      error: "Bitte eines deiner eigenen Häuser wählen.",
    });
    expect(await reorderArtifacts({ ids: [A], houseId: HOUSE })).toHaveProperty("error");
    expect(foreign.calls.some((c) => c.op === "update")).toBe(false);

    const own = fakeDb(true);
    mocks.requireUser.mockResolvedValue({ supabase: own.db, user: { id: USER } });
    expect(await bulkMoveArtifacts({ ids: [A, B], houseId: HOUSE })).toEqual({
      ok: true,
      count: 2,
    });
    const res = await reorderArtifacts({ ids: [B, A], houseId: HOUSE });
    expect(res).toEqual({ ok: true, count: 4 });
    const updates = own.calls.filter((c) => c.op === "update");
    // Reihenfolge: B bekommt sort 0, A sort 1, beide ins Zielhaus
    expect(updates.at(-2)!.args[0]).toEqual(["update", { sort: 0, house_id: HOUSE }]);
    expect(filters(updates.at(-2)!)).toContainEqual(["eq", "id", B]);
    expect(updates.at(-1)!.args[0]).toEqual(["update", { sort: 1, house_id: HOUSE }]);
  });
});
