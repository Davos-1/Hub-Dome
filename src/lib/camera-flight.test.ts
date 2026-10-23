import { describe, expect, it } from "vitest";
import {
  easeInOut,
  FLIGHT_MAX,
  FLIGHT_MIN,
  flightDuration,
  measureFlight,
  planFlight,
  type FlightPose,
} from "./camera-flight";

/** Typische Posen eines Dorfs (Übersicht, Quartier, Häuser auf beiden Seiten, Karte, Einflug). */
const OV: FlightPose = { position: [0, 60, 82], target: [0, 0, 0] };
const INTRO: FlightPose = { position: [0, 87, 119], target: [0, 0, 0] };
const QUARTER: FlightPose = { position: [-30, 30, -6], target: [-14, 0, -8] };
const HOUSE_A: FlightPose = { position: [-24, 10, -20], target: [-20, 1.1, -12] };
const HOUSE_B: FlightPose = { position: [26, 11, 14], target: [21, 1.1, 9] };
const ZENTRALE: FlightPose = { position: [0, 14, 30], target: [0, 6, 0] };
const KARTE: FlightPose = { position: [0, 95, 0.05], target: [0, 0, 0] };

const CASES: [string, FlightPose, FlightPose][] = [
  ["Einflug", INTRO, OV],
  ["Dorf → Quartier", OV, QUARTER],
  ["Quartier → Haus", QUARTER, HOUSE_A],
  ["Haus → Haus gegenüber", HOUSE_A, HOUSE_B],
  ["Haus → Dorf", HOUSE_B, OV],
  ["Dorf → Zentrale", OV, ZENTRALE],
  ["Zentrale → Haus", ZENTRALE, HOUSE_A],
  ["Dorf → Karte", OV, KARTE],
  ["Karte → Haus", KARTE, HOUSE_B],
];

describe("Kamerafahrt", () => {
  it("Ease beginnt und endet ohne Geschwindigkeit und ist stetig", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    const h = 1e-4;
    expect((easeInOut(h) - easeInOut(0)) / h).toBeLessThan(1e-6);
    expect((easeInOut(1) - easeInOut(1 - h)) / h).toBeLessThan(1e-6);
  });

  it("Dauer hängt von Weg und Drehung ab und bleibt im Band 2.0–3.2 s", () => {
    expect(flightDuration(0, 0)).toBe(FLIGHT_MIN);
    expect(flightDuration(10, 0)).toBeLessThan(flightDuration(80, 0));
    expect(flightDuration(20, 0)).toBeLessThan(flightDuration(20, Math.PI));
    expect(flightDuration(1e6, Math.PI)).toBe(FLIGHT_MAX);
  });

  it.each(CASES)("%s: beginnt und endet exakt in den Posen", (_, from, to) => {
    const f = planFlight(from, to);
    const a = f.at(0);
    const b = f.at(1);
    a.position.forEach((c, i) => expect(c).toBeCloseTo(from.position[i], 6));
    a.target.forEach((c, i) => expect(c).toBeCloseTo(from.target[i], 6));
    expect(b).toEqual(to);
  });

  it.each(CASES)("%s: ruhig (Drehrate, Drehbeschleunigung, keine Sprünge)", (_, from, to) => {
    const s = measureFlight(planFlight(from, to));
    expect(s.duration).toBeGreaterThanOrEqual(FLIGHT_MIN);
    expect(s.duration).toBeLessThanOrEqual(FLIGHT_MAX);
    // Blick dreht höchstens 90°/s, die Drehrate ändert sich höchstens um 250°/s pro Sekunde
    expect(s.maxTurnRate).toBeLessThanOrEqual(90);
    expect(s.maxTurnAccel).toBeLessThanOrEqual(250);
    // Pro Bild höchstens 5 % des Abstands zum Ziel (kein Ruck, auch nicht beim Einflug)
    expect(s.maxRelStep).toBeLessThanOrEqual(0.05);
  });

  it("bleibt bei 30 Bildern/s (Handy) ebenso ruhig", () => {
    for (const [, from, to] of CASES) {
      const s = measureFlight(planFlight(from, to), 30);
      expect(s.maxTurnRate).toBeLessThanOrEqual(90);
      expect(s.maxRelStep).toBeLessThanOrEqual(0.1);
    }
  });
});

describe("Kamerafahrt über hohe Bauten", () => {
  it("hält Abstand zur Zentrale, auch wenn die Bahn darüber führt", () => {
    const tower = { x: 0, z: 0, r: 4.6, top: 15 };
    const from: FlightPose = { position: [0, 30, 60], target: [0, 0, 0] };
    const to: FlightPose = { position: [2, 9, -26], target: [0, 1.1, -38] };
    const f = planFlight(from, to, [tower]);
    for (let i = 1; i < 100; i++) {
      const p = f.at(i / 100).position;
      if (Math.hypot(p[0], p[2]) < tower.r + 3) expect(p[1]).toBeGreaterThan(tower.top + 3);
    }
    expect(measureFlight(f).maxTurnRate).toBeLessThanOrEqual(90);
  });
});
