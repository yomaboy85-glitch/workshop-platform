'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const HEARTBEAT_MS = 55_000;

interface UserProfile {
  id: string;
  auth_id: string;
  name: string;
  role: 'admin' | 'user';
  is_online: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profileIdRef = useRef<string | null>(null);

  const fetchProfile = async (authUser: User) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();
    if (data) {
      setProfile(data as UserProfile);
      profileIdRef.current = data.id;
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', data.id);
      startHeartbeat(data.id);
    }
  };

  const startHeartbeat = (userId: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', userId);
    }, HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user);
        } else {
          stopHeartbeat();
          setProfile(null);
          profileIdRef.current = null;
        }
        setLoading(false);
      }
    );

    const handleUnload = () => {
      const pid = profileIdRef.current;
      if (pid) {
        // Use sendBeacon to fire-and-forget (works on page close)
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${pid}`;
        const data = JSON.stringify({ is_online: false });
        if (typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      subscription.unsubscribe();
      stopHeartbeat();
      window.removeEventListener('beforeunload', handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    if (profileIdRef.current) {
      await supabase
        .from('users')
        .update({ is_online: false })
        .eq('id', profileIdRef.current);
    }
    stopHeartbeat();
    await supabase.auth.signOut();
    setProfile(null);
    profileIdRef.current = null;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      isAdmin: profile?.role === 'admin',
      loading, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
