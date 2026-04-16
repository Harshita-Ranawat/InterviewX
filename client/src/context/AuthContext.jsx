import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase.js";
import { apiFetch } from "../api/http.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      try {
        if (fbUser) {
          try {
            const me = await apiFetch("/api/auth/me");
            setProfile(me);
          } catch {
            setProfile(null);
          }
          // Do not block UI on Firestore (rules/offline can stall or hang the session loader).
          void setDoc(
            doc(db, "presence_meta", fbUser.uid),
            { email: fbUser.email || "", updatedAt: serverTimestamp() },
            { merge: true }
          ).catch(() => {});
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      async loginEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async registerEmail(email, password) {
        await createUserWithEmailAndPassword(auth, email, password);
      },
      async loginGoogle() {
        await signInWithPopup(auth, googleProvider);
      },
      async logout() {
        await signOut(auth);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
      },
      async refreshProfile() {
        if (!auth.currentUser) return;
        const me = await apiFetch("/api/auth/me");
        setProfile(me);
        return me;
      },
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
