'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { GameWaiting, GameEnded } from '@/components/GameStatus';
import { useRealtime } from '@/hooks/useRealtime';
import ScorePopup from '@/components/ScorePopup';

interface Mission {
  title: string;
  description: string;
  score: number;
}

interface MissionConfig {
  missionList: Mission[];
  scorePerMission: number;
}

interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'ended';
  config: MissionConfig;
}

export default function MissionGamePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const { showToast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [scorePopup, setScorePopup] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) { router.push('/login'); return; }
    fetchAll();
  }, [profile]);

  const fetchAll = async () => {
    const [{ data: gameData }, { data: compData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('mission_completions').select('mission_index')
        .eq('game_id', gameId).eq('user_id', profile!.id),
    ]);
    if (gameData) setGame(gameData as unknown as Game);
    if (compData) setCompleted(new Set(compData.map((m: { mission_index: number }) => m.mission_index)));
    setLoading(false);
  };

  useRealtime(`mission-${gameId}`, [{
    table: 'games', filter: `id=eq.${gameId}`,
    onUpdate: (row) => setGame(prev => prev ? { ...prev, ...(row as Partial<Game>) } : null),
  }], !!gameId);

  const completeMission = async (idx: number) => {
    if (!game || !profile || completed.has(idx) || claiming !== null) return;
    setClaiming(idx);

    const mission = game.config.missionList[idx];
    const score = mission.score || game.config.scorePerMission || 50;

    const { error } = await supabase.from('mission_completions').insert({
      game_id: gameId,
      user_id: profile.id,
      mission_index: idx,
    });

    if (error) {
      showToast('이미 완료한 미션입니다.', 'warning');
      setClaiming(null);
      return;
    }

    const { data: tm } = await supabase
      .from('team_members').select('team_id').eq('user_id', profile.id).maybeSingle();

    await supabase.from('scores').insert({
      user_id: profile.id,
      team_id: tm?.team_id || null,
      game_id: gameId,
      points: score,
      reason: `미션 완료: ${mission.title}`,
    });

    if (tm?.team_id) {
      const { data: teamRow } = await supabase
        .from('teams').select('total_score').eq('id', tm.team_id).single();
      if (teamRow) {
        await supabase.from('teams')
          .update({ total_score: teamRow.total_score + score })
          .eq('id', tm.team_id);
      }
    }

    setCompleted(prev => new Set([...prev, idx]));
    setScorePopup(score);
    showToast(`✅ 미션 완료! +${score}점`, 'success');
    setClaiming(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  if (!game) return null;
  if (game.status === 'waiting') return <GameWaiting gameName={game.name} gameEmoji="🎯" />;

  const missions = game.config.missionList || [];
  const completedCount = completed.size;

  if (game.status === 'ended') {
    return (
      <GameEnded
        gameName={game.name}
        summary={
          <div className="bg-emerald-50 rounded-2xl p-5">
            <p className="text-4xl font-bold text-emerald-600">{completedCount} / {missions.length}</p>
            <p className="text-slate-500 mt-1">미션 완료</p>
          </div>
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {scorePopup !== null && (
        <ScorePopup score={scorePopup} onDone={() => setScorePopup(null)} />
      )}

      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.push('/')} className="text-emerald-200 text-sm">← 뒤로</button>
        </div>
        <h1 className="text-xl font-bold mb-1">🎯 {game.name}</h1>
        <p className="text-emerald-200 text-sm">완료: {completedCount}/{missions.length}개</p>
        <div className="mt-3 h-2 bg-emerald-600/50 rounded-full">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${missions.length > 0 ? (completedCount / missions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3 max-w-lg mx-auto">
        {missions.map((mission, idx) => {
          const isDone = completed.has(idx);
          const isClaiming = claiming === idx;

          return (
            <div
              key={idx}
              className={`card transition-all duration-300 ${isDone ? 'bg-emerald-50 border-2 border-emerald-200' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
                  isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDone ? 'text-emerald-700 line-through decoration-emerald-400' : 'text-slate-800'}`}>
                    {mission.title}
                  </h3>
                  {mission.description && (
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{mission.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="badge badge-green">{mission.score || game.config.scorePerMission}점</span>
                    {!isDone && game.status === 'playing' && (
                      <button
                        onClick={() => completeMission(idx)}
                        disabled={isClaiming}
                        className="btn-success text-sm py-1.5 px-4"
                      >
                        {isClaiming ? '처리 중...' : '✅ 완료하기'}
                      </button>
                    )}
                    {isDone && (
                      <span className="text-emerald-600 font-bold text-sm">완료! 🎉</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {missions.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-slate-400">미션이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
