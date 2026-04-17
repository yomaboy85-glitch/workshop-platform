'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type Table =
  | 'games'
  | 'scores'
  | 'teams'
  | 'treasures'
  | 'announcements'
  | 'users'
  | 'team_members'
  | 'quiz_answers'
  | 'mission_completions'
  | 'votes';

interface SubscriptionConfig {
  table: Table;
  filter?: string;
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  onChange?: (payload: Record<string, unknown>) => void;
}

/**
 * Subscribe to multiple Supabase Realtime channels in one hook.
 * Automatically cleans up on unmount.
 *
 * Usage:
 *   useRealtime('my-channel', [
 *     { table: 'games', onChange: () => refetch() },
 *     { table: 'scores', filter: `game_id=eq.${gameId}`, onInsert: handleNewScore },
 *   ]);
 */
export function useRealtime(
  channelName: string,
  subscriptions: SubscriptionConfig[],
  enabled = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    let channel = supabase.channel(channelName);

    for (const sub of subscriptions) {
      const events: Array<'INSERT' | 'UPDATE' | 'DELETE' | '*'> = [];

      if (sub.onChange) events.push('*');
      else {
        if (sub.onInsert) events.push('INSERT');
        if (sub.onUpdate) events.push('UPDATE');
        if (sub.onDelete) events.push('DELETE');
      }

      for (const event of events) {
        channel = channel.on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table: sub.table,
            ...(sub.filter ? { filter: sub.filter } : {}),
          },
          (payload) => {
            if (event === '*' || event === 'INSERT') sub.onInsert?.(payload.new as Record<string, unknown>);
            if (event === '*' || event === 'UPDATE') sub.onUpdate?.(payload.new as Record<string, unknown>);
            if (event === '*' || event === 'DELETE') sub.onDelete?.(payload.old as Record<string, unknown>);
            sub.onChange?.(payload.new as Record<string, unknown>);
          }
        );
      }
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled]);
}
