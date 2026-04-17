'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

/**
 * Sends periodic heartbeats to Supabase to keep the user's
 * online status accurate. Call this once in the root layout
 * or a page that's always mounted when logged in.
 */
export function usePresence(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const beat = async () => {
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', userId);
    };

    // Immediate beat on mount
    beat();

    // Periodic beats
    intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    // Mark offline on unmount / page close
    const markOffline = () => {
      // Use sendBeacon for page unload (non-blocking)
      navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${userId}`,
        JSON.stringify({ is_online: false })
      );
    };

    window.addEventListener('beforeunload', markOffline);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // pause heartbeat
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        // resume heartbeat
        beat();
        intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL);
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', markOffline);
    };
  }, [userId]);
}
