/**
 * Realtime Database facade.
 *
 * Re-exports the `firebase/database` functions the app uses, but transparently
 * routes to the in-memory demo store (`@/lib/demoData`) when guest/demo mode is
 * active. Application code imports these from `@/lib/db` instead of
 * `firebase/database`, so the same page code works for real users and guests.
 */

import * as real from "firebase/database";
import * as demo from "./demoData";

export function ref(db: any, path?: string): any {
  return demo.isDemoMode() ? demo.ref(db, path) : real.ref(db, path);
}

export function query(r: any, ...mods: any[]): any {
  return demo.isDemoMode() ? demo.query(r, ...mods) : (real.query as any)(r, ...mods);
}

export function limitToLast(n: number): any {
  return demo.isDemoMode() ? demo.limitToLast(n) : real.limitToLast(n);
}

export function onValue(r: any, cb: any, error?: any): () => void {
  return demo.isDemoMode() ? demo.onValue(r, cb, error) : real.onValue(r, cb, error);
}

export function onChildAdded(r: any, cb: any): () => void {
  return demo.isDemoMode() ? demo.onChildAdded(r, cb) : (real.onChildAdded as any)(r, cb);
}

export function set(r: any, value: any): Promise<void> {
  return demo.isDemoMode() ? demo.set(r, value) : real.set(r, value);
}

export function update(r: any, value: any): Promise<void> {
  return demo.isDemoMode() ? demo.update(r, value) : real.update(r, value);
}

export function push(r: any): any {
  return demo.isDemoMode() ? demo.push(r) : real.push(r);
}
