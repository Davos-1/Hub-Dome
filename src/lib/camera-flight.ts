/**
 * Kamerafahrt als reine Rechnung (ohne three.js): von einer Pose zur nächsten im Bogen um das neue Ziel,
 * mit ruhigem Anfahren und Abbremsen. Die Szene (`camera-rig.tsx`) fragt pro Frame nur die Pose ab; Tests
 * können denselben Pfad abtasten und Geschwindigkeit und Beschleunigung prüfen.
 */

export type Vec3 = [number, number, number];
export type FlightPose = { position: Vec3; target: Vec3 };

export type Flight = {
  /** Dauer in Sekunden (2.0–3.2). */
  duration: number;
  /** Pose beim Fortschritt `u` (0 = Start, 1 = Ziel, gleichmässig in der Zeit). */
  at: (u: number) => FlightPose;
};

/** Kürzeste und längste Fahrt (Sekunden). */
export const FLIGHT_MIN = 2.0;
export const FLIGHT_MAX = 3.2;
/** Fast senkrechter Blick (Karte): kein Schwenk um das Ziel, sonst entsteht eine Spirale. */
const TOP_DOWN_PHI = 0.2;

/** Anteil der Fahrt zum Anfahren bzw. Abbremsen (je Ende). */
const RAMP = 0.3;
/** Höchstgeschwindigkeit in der Mitte, damit der ganze Weg 1 ergibt. */
const VMAX = 1 / (1 - RAMP);

/**
 * Sanftes Ein- und Ausblenden: Die Geschwindigkeit steigt im ersten Drittel weich (Kosinus) von null an,
 * bleibt in der Mitte gleich und sinkt am Ende ebenso weich. Geschwindigkeit und Beschleunigung sind an beiden
 * Enden null (kein Ruck); die Spitzengeschwindigkeit ist nur das 1.43-Fache des Mittels (Smootherstep: 1.88),
 * so dreht auch eine halbe Umrundung gelassen.
 */
export const easeInOut = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  if (x > 0.5) return 1 - easeInOut(1 - x);
  if (x < RAMP) return VMAX * (x / 2 - (RAMP / (2 * Math.PI)) * Math.sin((Math.PI * x) / RAMP));
  return VMAX * (RAMP / 2 + (x - RAMP));
};

type Spherical = { radius: number; phi: number; theta: number };

/** Kugelkoordinaten wie in three.js: `phi` vom Zenit (+y), `theta` um die y-Achse ab +z. */
function toSpherical(x: number, y: number, z: number): Spherical {
  const radius = Math.hypot(x, y, z);
  if (radius === 0) return { radius: 0, phi: 0, theta: 0 };
  return {
    radius,
    phi: Math.acos(Math.min(1, Math.max(-1, y / radius))),
    theta: Math.atan2(x, z),
  };
}

function fromSpherical(s: Spherical): Vec3 {
  const sp = Math.sin(s.phi) * s.radius;
  return [sp * Math.sin(s.theta), Math.cos(s.phi) * s.radius, sp * Math.cos(s.theta)];
}

/** Kürzester Drehweg von a nach b (−π…π). */
export const angleDelta = (a: number, b: number) => {
  const d = (b - a) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Dauer nach Strecke und Drehwinkel: kurze Wege 2 s, eine halbe Umrundung oder ein weiter Weg bis 3.2 s.
 * `travel` misst, wie weit sich Ziel und Abstand ändern (Meter), `turn` den Drehwinkel um das Ziel.
 */
export function flightDuration(travel: number, turn: number): number {
  const d =
    FLIGHT_MIN + 0.6 * Math.min(1, Math.abs(turn) / Math.PI) + 0.3 * Math.log2(1 + travel / 30);
  return Math.min(FLIGHT_MAX, Math.max(FLIGHT_MIN, d));
}

/**
 * Plant eine Fahrt. Blickpunkt und Versatz der Kamera (Kugelkoordinaten um den Blickpunkt) laufen mit
 * derselben Kurve: Die Kamera kreist im Bogen um den wandernden Blickpunkt, der Blick zeigt immer genau auf ihn
 * (kein Nachdrehen, keine Spirale). Der Abstand ändert sich gleichmässig im Verhältnis (logarithmisch: ein
 * Anflug aus 100 m auf 15 m wirkt am Ende nicht hastig). Bei weitem Weg weicht die Kamera in der Mitte etwas
 * zurück (erst Überblick, dann wieder heran), bei grossem Bogen steigt sie etwas an (nicht durch Dächer).
 */
export function planFlight(
  from: FlightPose,
  to: FlightPose,
  /** Hohe Bauten (z.B. Zentrale): Die Kamera fliegt mit Abstand darüber hinweg statt knapp daran vorbei. */
  obstacles: Obstacle[] = [],
): Flight {
  const f = toSpherical(
    from.position[0] - from.target[0],
    from.position[1] - from.target[1],
    from.position[2] - from.target[2],
  );
  const e = toSpherical(
    to.position[0] - to.target[0],
    to.position[1] - to.target[1],
    to.position[2] - to.target[2],
  );
  const topDown = f.phi < TOP_DOWN_PHI || e.phi < TOP_DOWN_PHI;
  const turn = topDown ? 0 : angleDelta(f.theta, e.theta);
  const share = Math.abs(turn) / Math.PI;
  const r0 = Math.max(0.5, f.radius);
  const r1 = Math.max(0.5, e.radius);
  const shift = dist(from.target, to.target);
  const travel = shift + Math.abs(r0 - r1) * 0.5;
  const lift = share * 0.18 * Math.max(r0, r1);
  const hop = 0.35 * shift;
  const duration = flightDuration(travel, turn);

  let clear = 0;
  const base = (u: number): FlightPose => {
    if (u >= 1) return { position: [...to.position], target: [...to.target] };
    const k = easeInOut(u);
    const bump = Math.sin(Math.PI * k);
    const theta = turn === 0 ? lerp(f.theta, e.theta, k) : f.theta + turn * k;
    const radius = r0 * Math.pow(r1 / r0, k) + hop * bump;
    const off = fromSpherical({ radius, phi: lerp(f.phi, e.phi, k), theta });
    const target: Vec3 = [
      lerp(from.target[0], to.target[0], k),
      lerp(from.target[1], to.target[1], k),
      lerp(from.target[2], to.target[2], k),
    ];
    return {
      position: [
        target[0] + off[0],
        target[1] + off[1] + bump * (lift + clear),
        target[2] + off[2],
      ],
      target,
    };
  };
  // Zusätzlicher Bogen nach oben, wo die Bahn einem hohen Bau zu nahe käme (weich über die ganze Fahrt;
  // gemessen an der Bahn ohne diesen Zuschlag)
  let extra = 0;
  for (let i = 1; i < 48; i++) {
    const u = i / 48;
    const p = base(u).position;
    const bump = Math.sin(Math.PI * easeInOut(u));
    for (const o of obstacles) {
      if (Math.hypot(p[0] - o.x, p[2] - o.z) > o.r + CLEARANCE) continue;
      const need = o.top + CLEARANCE - p[1];
      if (need > 0) extra = Math.max(extra, need / Math.max(bump, 0.35));
    }
  }
  clear = extra;
  return { duration, at: base };
}

/** Hohes Hindernis (Zylinder: Mitte, Radius, Oberkante). */
export type Obstacle = { x: number; z: number; r: number; top: number };
/** Abstand der Kamera zu hohen Bauten (seitlich und darüber), Meter. */
const CLEARANCE = 5;

/** Kennzahlen eines abgetasteten Pfads (Tests, Abstimmung). */
export type FlightStats = {
  duration: number;
  /** Höchste Drehgeschwindigkeit der Blickrichtung (Grad/s). */
  maxTurnRate: number;
  /** Höchste Änderung der Drehgeschwindigkeit (Grad/s²). */
  maxTurnAccel: number;
  /** Höchste Geschwindigkeit der Kamera, bezogen auf ihren Abstand zum Ziel (1/s). */
  maxRelSpeed: number;
  /** Grösster Sprung zwischen zwei Frames relativ zum Abstand (Ruckfreiheit). */
  maxRelStep: number;
};

/** Tastet die Fahrt mit `fps` Bildern pro Sekunde ab und misst Dreh- und Fahrgeschwindigkeit. */
export function measureFlight(flight: Flight, fps = 60): FlightStats {
  const n = Math.max(2, Math.ceil(flight.duration * fps));
  const dt = flight.duration / n;
  const poses = Array.from({ length: n + 1 }, (_, i) => flight.at(i / n));
  const dirs = poses.map((p) => {
    const d: Vec3 = [
      p.target[0] - p.position[0],
      p.target[1] - p.position[1],
      p.target[2] - p.position[2],
    ];
    const l = Math.hypot(...d) || 1;
    return d.map((c) => c / l) as Vec3;
  });
  const rates: number[] = [];
  let maxRelSpeed = 0;
  let maxRelStep = 0;
  for (let i = 1; i <= n; i++) {
    const dot =
      dirs[i][0] * dirs[i - 1][0] + dirs[i][1] * dirs[i - 1][1] + dirs[i][2] * dirs[i - 1][2];
    rates.push((Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI / dt);
    const step = dist(poses[i].position, poses[i - 1].position);
    const r = Math.max(1, dist(poses[i].position, poses[i].target));
    maxRelSpeed = Math.max(maxRelSpeed, step / dt / r);
    maxRelStep = Math.max(maxRelStep, step / r);
  }
  let maxTurnAccel = 0;
  for (let i = 1; i < rates.length; i++)
    maxTurnAccel = Math.max(maxTurnAccel, Math.abs(rates[i] - rates[i - 1]) / dt);
  return {
    duration: flight.duration,
    maxTurnRate: Math.max(...rates),
    maxTurnAccel,
    maxRelSpeed,
    maxRelStep,
  };
}
