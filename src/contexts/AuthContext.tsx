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
  user: null, session: null, profile: null,
  isAdmin: false, loading: true,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profileIdRef = useRef<string | null>(null);

  const fetchProfile = async (authUser: User): Promise<void> => {
    try {
      let { data } = await supabase
        .from('users').select('*').eq('auth_id', authUser.id).maybeSingle();

      // auth는 있는데 public.users row가 없는 "반쪽 계정" 자동 복구
      if (!data) {
        const fallbackName = (authUser.user_metadata?.name as string)
          || authUser.email?.split('@')[0]
          || '사용자';
        const { data: created } = await supabase
          .from('users')
          .insert({
            auth_id: authUser.id,
            name: fallbackName,
            role: 'user',
            is_online: true,
          })
          .select('*')
          .maybeSingle();
        data = created;
      }

      if (data) {
        setProfile(data as UserProfile);
        profileIdRef.current = data.id;
        supabase.from('users')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', data.id).then(() => {});
        startHeartbeat(data.id);
      }
    } catch (_) {}
  };

  const startHeartbeat = (userId: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      await supabase.from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', userId);
    }, HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };

  const refreshProfile = async () => { if (user) await fetchProfile(user); };

  useEffect(() => {
    let mounted = true;

    // 어떤 상황에서도 5초 내에 loading=false 보장 (스피너 무한 대기 방지)
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // 1) 먼저 현재 세션 빠르게 가져오기
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      try {
        if (session?.user) await fetchProfile(session.user);
      } finally {
        if (mounted) setLoading(false);
      }
    }).catch(() => { if (mounted) setLoading(false); });

    // 2) 이후 변경사항 감지 (로그인/로그아웃)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        // INITIAL_SESSION은 getSession이 처리하므로 무시
        if (event === 'INITIAL_SESSION') return;
        setSession(session);
        setUser(session?.user ?? null);
        try {
          if (session?.user) {
            await fetchProfile(session.user);
          } else {
            stopHeartbeat();
            setProfile(null);
            profileIdRef.current = null;
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }
    );

    window.addEventListener('beforeunload', () => {
      const pid = profileIdRef.current;
      if (pid) navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${pid}`,
        new Blob([JSON.stringify({ is_online: false })], { type: 'application/json' })
      );
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      stopHeartbeat();
    };
  }, []);

  const signOut = async () => {
    if (profileIdRef.current) {
      await supabase.from('users').update({ is_online: false }).eq('id', profileIdRef.current);
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
