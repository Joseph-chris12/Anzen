import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { isDemoMode, setDemoMode } from "@/lib/demoData";

/** A synthetic user used when exploring the app as a guest (demo mode). */
export interface GuestUser {
  uid: string;
  email: string;
  isGuest: true;
}

export type AppUser = User | GuestUser;

const GUEST_USER: GuestUser = {
  uid: "demo-guest",
  email: "guest@dmax.demo",
  isGuest: true,
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState<boolean>(() => isDemoMode());

  useEffect(() => {
    // Restore a persisted guest session without contacting Firebase.
    if (isDemoMode()) {
      setUser(GUEST_USER);
      setIsGuest(true);
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured() || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // Ignore Firebase auth changes while a guest is browsing in demo mode.
      if (isDemoMode()) return;
      setUser(u);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase not configured");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase not configured");
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInAsGuest = async () => {
    setDemoMode(true);
    setUser(GUEST_USER);
    setIsGuest(true);
    setLoading(false);
  };

  const signOut = async () => {
    if (isDemoMode()) {
      setDemoMode(false);
      setUser(null);
      setIsGuest(false);
      return;
    }
    if (!auth) throw new Error("Firebase not configured");
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isGuest, signIn, signOut, signUp, signInAsGuest }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
