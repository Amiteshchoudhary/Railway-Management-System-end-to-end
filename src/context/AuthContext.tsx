import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface PassengerProfile {
  uid: string;
  name: string;
  email: string;
  authMode: 'firebase' | 'passenger';
}

interface AuthContextValue {
  passenger: PassengerProfile | null;
  idToken: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsPassenger: (name: string, email: string, customUid?: string) => Promise<void>;
  signOutPassenger: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_DEMO_PASSENGER: PassengerProfile = {
  uid: 'demo-passenger-01',
  name: 'Aarav Sharma',
  email: 'aarav.sharma@bharatrail.in',
  authMode: 'passenger',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [passenger, setPassenger] = useState<PassengerProfile | null>(DEFAULT_DEMO_PASSENGER);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const syncWithBackend = useCallback(
    async (profile: PassengerProfile, token: string | null) => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          headers['x-passenger-uid'] = profile.uid;
          headers['x-passenger-email'] = profile.email;
          headers['x-passenger-name'] = profile.name;
        }
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: profile.name,
            email: profile.email,
          }),
        });
      } catch (err) {
        console.error('Failed to sync passenger session:', err);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const profile: PassengerProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Passenger',
          email: firebaseUser.email || `${firebaseUser.uid}@bharatrail.in`,
          authMode: 'firebase',
        };
        setIdToken(token);
        setPassenger(profile);
        await syncWithBackend(profile, token);
      }
    });
    return () => unsubscribe();
  }, [syncWithBackend]);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const token = await credential.user.getIdToken();
      const profile: PassengerProfile = {
        uid: credential.user.uid,
        name: credential.user.displayName || 'Express Passenger',
        email: credential.user.email || `${credential.user.uid}@bharatrail.in`,
        authMode: 'firebase',
      };
      setIdToken(token);
      setPassenger(profile);
      await syncWithBackend(profile, token);
    } finally {
      setLoading(false);
    }
  };

  const signInAsPassenger = async (name: string, email: string, customUid?: string) => {
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const uid =
        customUid ||
        (cleanEmail === 'aarav.sharma@bharatrail.in'
          ? 'demo-passenger-01'
          : `passenger-${cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 16)}`);
      const profile: PassengerProfile = {
        uid,
        name: name.trim(),
        email: cleanEmail,
        authMode: 'passenger',
      };
      setIdToken(null);
      setPassenger(profile);
      await syncWithBackend(profile, null);
    } finally {
      setLoading(false);
    }
  };

  const signOutPassenger = async () => {
    try {
      if (passenger?.authMode === 'firebase') {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setIdToken(null);
    setPassenger(null);
  };

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    } else if (passenger) {
      headers['x-passenger-uid'] = passenger.uid;
      headers['x-passenger-email'] = passenger.email;
      headers['x-passenger-name'] = passenger.name;
    }
    return headers;
  }, [idToken, passenger]);

  return (
    <AuthContext.Provider
      value={{
        passenger,
        idToken,
        loading,
        signInWithGoogle,
        signInAsPassenger,
        signOutPassenger,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
