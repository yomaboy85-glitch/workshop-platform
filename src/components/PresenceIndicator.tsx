'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PresenceIndicator() {
  const [onlineCount, setOnlineCount] = useState(0);

  const fetchOnline = async () => {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true);
    setOnlineCount(count || 0);
  };

  useEffect(() => {
    fetchOnline();
    const channel = supabase
      .channel('presence-indicator')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, fetchOnline)
      .subscribe();
    // Refresh every 30s as heartbeat fallback
    const interval = setInterval(fetchOnline, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      <span className="text-xs text-slate-500">{onlineCount}명 접속 중</span>
    </div>
  );
}
