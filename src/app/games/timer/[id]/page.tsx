'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { GameWaiting } from '@/components/GameStatus';
import { useRealtime } from '@/hooks/useRealtime';

interface TimerConfig {
  duration: number;
  rules: string;
  scoreOnComplete: number;
}

interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'ended';
  config: TimerConfig;
  started_at: string | null;
}

export default function TimerGamePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) { router.push('/login'); return; }
    fetchGame();
  }, [profile]);

  const fetchGame = async () => {
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (data) {
      const g = data as unknown as Game;
      setGame(g);
      recalcTime(g);
    }
    setLoading(false);
  };

  const recalcTime = (g: Game) => {
    if (g.status === 'playing' && g.started_at) {
      const elapsed = Math.floor((Date.now() - new Date(g.started_at).getTime()) / 1000);
      setTimeLeft(Math.max(0, g.config.duration - elapsed));
    } else if (g.status === 'waiting') {
      setTimeLeft(g.config.duration || 0);
    } else {
      setTimeLeft(0);
    }
  };

  useRealtime(`timer-${gameId}`, [{
    table: 'games', filter: `id=eq.${gameId}`,
    onUpdate: (row) => {
      const updated = row as unknown as Game;
      setGame(prev => prev ? { ...prev, ...updated } : null);
      recalcTime(updated);
    },
  }], !!gameId);

  // Tick down
  useEffect(() => {
    if (!game || game.status !== 'playing' || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, game?.status]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  if (!game) return null;
  if (game.status === 'waiting') return <GameWaiting gameName={game.name} gameEmoji="⏱️" />;

  const totalDuration = game.config.duration || 1;
  const pct = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));
  const isUrgent = timeLeft <= 30 && timeLeft > 0 && game.status === 'playing';
  const isDone = timeLeft === 0 || game.status === 'ended';

  // SVG circle params
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct / 100);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-1000 ${
      isUrgent ? 'bg-red-50' : 'bg-slate-50'
    }`}>
      <div className={`text-white px-4 pt-6 pb-8 transition-all duration-1000 ${
        isDone ? 'bg-gradient-to-r from-slate-500 to-slate-600' :
        isUrgent ? 'bg-gradient-to-r from-red-500 to-orange-500' :
        'bg-gradient-to-r from-sky-500 to-blue-600'
      }`}>
        <button onClick={() => router.push('/')} className="text-white/60 text-sm mb-3 block">← 뒤로</button>
        <h1 className="text-xl font-bold">⏱️ {game.name}</h1>
        {game.status === 'playing' && !isDone && (
          <p className="text-white/70 text-sm mt-1">
            {isUrgent ? '⚠️ 시간이 얼마 남지 않았습니다!' : '게임이 진행 중입니다'}
          </p>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6 -mt-4">
        {/* Timer ring */}
        <div className="card max-w-xs w-full text-center pt-10 pb-8">
          <div className="relative w-52 h-52 mx-auto mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Track */}
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
              {/* Progress */}
              <circle
                cx="50" cy="50" r={radius} fill="none"
                stroke={isDone ? '#94a3b8' : isUrgent ? '#ef4444' : '#3b82f6'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${strokeDashoffset}`}
                className="transition-all duration-1000"
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-bold font-mono tabular-nums ${
                isDone ? 'text-3xl text-slate-400' :
                isUrgent ? 'text-4xl text-red-500' :
                'text-4xl text-slate-800'
              } ${isUrgent ? 'animate-pulse' : ''}`}>
                {formatTime(timeLeft)}
              </span>
              {!isDone && (
                <span className="text-xs text-slate-400 mt-1">남은 시간</span>
              )}
            </div>
          </div>

          {game.status === 'playing' && !isDone && (
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm">진행 중</span>
            </div>
          )}
          {isDone && (
            <div>
              <p className="text-xl font-bold text-slate-600">⏰ 시간 종료!</p>
              <button className="btn-primary mt-4 px-8" onClick={() => router.push('/')}>
                홈으로 돌아가기
              </button>
            </div>
          )}
        </div>

        {/* Rules */}
        {game.config.rules && (
          <div className="card max-w-xs w-full">
            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
              <span>📋</span> 게임 규칙
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {game.config.rules}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
