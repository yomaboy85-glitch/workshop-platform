'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from './useRealtime';

interface Game {
  id: string;
  name: string;
  type: string;
  status: 'waiting' | 'playing' | 'ended';
  config: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
}

/**
 * Fetches a game by ID and subscribes to realtime status changes.
 */
export function useGameState(gameId: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = async () => {
    const { data, error: err } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (err) {
      setError('게임을 불러올 수 없습니다.');
    } else {
      setGame(data as unknown as Game);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  useRealtime(
    `game-state-${gameId}`,
    [{
      table: 'games',
      filter: `id=eq.${gameId}`,
      onUpdate: (newRow) => {
        setGame(prev => prev ? { ...prev, ...(newRow as Partial<Game>) } : null);
      },
    }],
    !!gameId
  );

  return { game, loading, error, refetch: fetchGame };
}
