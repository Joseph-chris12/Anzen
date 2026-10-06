/**
 * D-MAX — Guest / Demo mode.
 *
 * A tiny in-memory mock of the Firebase Realtime Database so that anyone can
 * try the app with realistic dummy data without touching the real database
 * (or even having Firebase configured at all). It implements just the slice of
 * the `firebase/database` API that the app actually uses, and is wired in via
 * `@/lib/db`, which dispatches to either this mock or the real SDK depending on
 * whether demo mode is active.
 *
 * Nothing here is persisted: a page refresh resets the demo to its seed state.
 */

import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Demo-mode flag (persisted across reloads so a guest stays "logged in")
// ---------------------------------------------------------------------------

let DEMO = false;
try {
  DEMO = localStorage.getItem("dmax_demo") === "1";
} catch {
  /* localStorage may be unavailable (private mode, etc.) */
}

export function isDemoMode(): boolean {
  return DEMO;
}

export function setDemoMode(on: boolean): void {
  DEMO = on;
  try {
    if (on) localStorage.setItem("dmax_demo", "1");
    else localStorage.removeItem("dmax_demo");
  } catch {
    /* ignore */
  }
  if (on) {
    ensureSeed();
  } else {
    stopHeartbeat();
    store = null;
    listeners.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

/** Format a date `daysAgo` days back at a given time as "YYYY-MM-DD HH:MM:SS". */
function ts(daysAgo: number, h: number, m: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, Math.floor(Math.random() * 60), 0);
  return format(d, "yyyy-MM-dd HH:mm:ss");
}

/** ISO timestamp `daysAgo` days back (used for guest-pass dates). */
function iso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

let seq = 0;
function genKey(): string {
  seq += 1;
  return `-demo${Date.now().toString(36)}${seq.toString(36)}`;
}

/** Build a fresh copy of the demo database. */
function seed(): any {
  // Logs are inserted oldest -> newest; the UI reverses them for display.
  const logs: Record<string, any> = {};
  const addLog = (entry: any) => {
    logs[genKey()] = entry;
  };

  addLog({ name: "MAX_VERSTAPPEN", method: "Face ID", timestamp: ts(6, 7, 42), status: "granted" });
  addLog({ name: "MOM", method: "Face ID", timestamp: ts(5, 8, 15), status: "granted" });
  addLog({ name: "DHL_COURIER", method: "QR Code", timestamp: ts(4, 13, 5), status: "granted" });
  addLog({ name: "UNKNOWN", method: "Intruder Alert", timestamp: ts(4, 23, 48), status: "denied" });
  addLog({ name: "JOSEPH_CHRISTIAN", method: "Face ID", timestamp: ts(3, 9, 2), status: "granted" });
  addLog({ name: "LANDO_NORRIS", method: "Face ID", timestamp: ts(2, 18, 30), status: "granted" });
  addLog({ name: "Admin", method: "Web Console", timestamp: ts(1, 20, 11), status: "granted" });
  addLog({ name: "JOSEPH_CHRISTIAN", method: "Face ID", timestamp: ts(0, 7, 55), status: "granted" });
  addLog({ name: "MOM", method: "Face ID", timestamp: ts(0, 12, 20), status: "granted" });

  const registered = (name: string) => ({
    name,
    registeredBy: "guest@dmax.demo",
    registeredAt: iso(10),
    status: "active",
  });

  return {
    door_status: "Closed",
    system_health: {
      last_seen: Date.now(),
      camera_active: true,
      arduino_active: true,
      qr_enabled: true,
    },
    registered_face: {
      MAX_VERSTAPPEN: registered("MAX_VERSTAPPEN"),
      JOSEPH_CHRISTIAN: registered("JOSEPH_CHRISTIAN"),
      LANDO_NORRIS: registered("LANDO_NORRIS"),
      MOM: registered("MOM"),
    },
    logs,
    guest_tokens: {
      [genKey()]: {
        guestName: "Grandma Rossi",
        token: "A1B2C3D4",
        createdAt: iso(1),
        expiresAt: iso(-2), // expires 2 days in the future
        createdBy: "guest@dmax.demo",
        status: "active",
      },
      [genKey()]: {
        guestName: "Pizza Delivery",
        token: "9F8E7D6C",
        createdAt: iso(3),
        expiresAt: iso(2), // already expired
        createdBy: "guest@dmax.demo",
        status: "used",
      },
    },
  };
}

let store: any = null;

function ensureSeed(): void {
  if (!store) {
    store = seed();
    startHeartbeat();
  }
}

// Keep the demo "online": refresh the Pi heartbeat so the dashboard health
// widget doesn't flip to offline after its 15s staleness timeout.
let heartbeat: ReturnType<typeof setInterval> | null = null;
function startHeartbeat(): void {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    if (!store) return;
    store.system_health = { ...store.system_health, last_seen: Date.now() };
    notify("system_health");
  }, 7000);
}
function stopHeartbeat(): void {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getPath(path: string): any {
  if (path === ".info/connected") return true;
  ensureSeed();
  if (!path) return store;
  const parts = path.split("/");
  let cur = store;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur === undefined ? null : cur;
}

function setPath(path: string, value: any): void {
  ensureSeed();
  const parts = path.split("/");
  let cur = store;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = value;
}

// ---------------------------------------------------------------------------
// Snapshot + listeners
// ---------------------------------------------------------------------------

function makeSnapshot(path: string) {
  const val = getPath(path);
  const key = path ? path.split("/").pop()! : null;
  return {
    key,
    val: () => val,
    exists: () => val != null,
    forEach: (cb: (child: any) => void) => {
      if (val && typeof val === "object") {
        for (const k of Object.keys(val)) cb(makeSnapshot(path ? `${path}/${k}` : k));
      }
    },
  };
}

type Entry = {
  path: string;
  type: "value" | "childAdded";
  cb: (snap: any) => void;
  seen?: Set<string>;
};

const listeners: Entry[] = [];

/** Is `a` equal to, an ancestor of, or a descendant of `b`? */
function related(a: string, b: string): boolean {
  return a === b || b.startsWith(a + "/") || a.startsWith(b + "/");
}

/** Direct child key of `parent` within `path`, or null. */
function directChildKey(parent: string, path: string): string | null {
  if (!path.startsWith(parent + "/")) return null;
  const rest = path.slice(parent.length + 1);
  return rest.indexOf("/") === -1 ? rest : null;
}

function notify(changedPath: string): void {
  for (const e of listeners.slice()) {
    if (e.type === "value" && related(e.path, changedPath)) {
      e.cb(makeSnapshot(e.path));
    } else if (e.type === "childAdded") {
      const childKey = directChildKey(e.path, changedPath);
      if (childKey && e.seen && !e.seen.has(childKey)) {
        e.seen.add(childKey);
        e.cb(makeSnapshot(`${e.path}/${childKey}`));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// firebase/database-compatible surface
// ---------------------------------------------------------------------------

export type DemoRef = { __demo: true; path: string; key: string | null };

export function ref(_db: unknown, path = ""): DemoRef {
  // When used via the facade, _db is actually the path on nested calls; keep it
  // simple: the facade always passes (db, path).
  const p = typeof path === "string" ? path : "";
  return { __demo: true, path: p, key: p ? p.split("/").pop()! : null };
}

export function query(r: DemoRef, ..._mods: unknown[]): DemoRef {
  // Modifiers (limitToLast, etc.) don't change what we store; pages slice
  // locally. We keep the same ref/path.
  return r;
}

export function limitToLast(_n: number): unknown {
  return { __demoMod: "limitToLast" };
}

export function onValue(
  r: DemoRef,
  cb: (snap: any) => void,
  _error?: (e: any) => void
): () => void {
  ensureSeed();
  const entry: Entry = { path: r.path, type: "value", cb };
  listeners.push(entry);
  // Fire immediately with current value (async, like the real SDK).
  Promise.resolve().then(() => cb(makeSnapshot(r.path)));
  return () => {
    const i = listeners.indexOf(entry);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function onChildAdded(r: DemoRef, cb: (snap: any) => void): () => void {
  ensureSeed();
  const current = getPath(r.path);
  const keys = current && typeof current === "object" ? Object.keys(current) : [];
  const seen = new Set<string>(keys);
  const entry: Entry = { path: r.path, type: "childAdded", cb, seen };
  listeners.push(entry);
  // Emulate limitToLast(1): fire once for the most recent existing child so the
  // caller's "skip first" initialiser consumes it.
  if (keys.length) {
    const lastKey = keys[keys.length - 1];
    Promise.resolve().then(() => cb(makeSnapshot(`${r.path}/${lastKey}`)));
  }
  return () => {
    const i = listeners.indexOf(entry);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function set(r: DemoRef, value: any): Promise<void> {
  setPath(r.path, value);
  notify(r.path);
  return Promise.resolve();
}

export function update(r: DemoRef, value: Record<string, any>): Promise<void> {
  const existing = getPath(r.path);
  setPath(r.path, { ...(existing && typeof existing === "object" ? existing : {}), ...value });
  notify(r.path);
  return Promise.resolve();
}

export function push(r: DemoRef): DemoRef {
  const key = genKey();
  const path = r.path ? `${r.path}/${key}` : key;
  return { __demo: true, path, key };
}
