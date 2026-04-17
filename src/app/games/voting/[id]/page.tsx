'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { GameWaiting, GameEnded } from '@/components/GameStatus';
import { useRealtime } from '@/hooks/useRealtime';

interface VotingConfig {
  question: string;
  options: string[];
}

interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'ended';
  config: VotingConfig;
}

type VoteTally = Record<number, number>;

export default function VotingGamePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const { showToast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [tally, setTally] = useState<VoteTally>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!profile) { router.push('/login'); return; }
    fetchAll();
  }, [profile]);

  const fetchAll = async () => {
    const [{ data: gameData }, { data: myVoteData }, { data: allVotes }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('votes').select('option_index').eq('game_id', gameId).eq('user_id', profile!.id).maybeSingle(),
      supabase.from('votes').select('option_index').eq('game_id', gameId),
    ]);
    if (gameData) setGame(gameData as unknown as Game);
    if (myVoteData) setMyVote(myVoteData.option_index);
    if (allVotes) {
      const t: VoteTally = {};
      allVotes.forEach((v: { option_index: number }) => {
        t[v.option_index] = (t[v.option_index] || 0) + 1;
      });
      setTally(t);
      setTotalVotes(allVotes.length);
    }
    setLoading(false);
  };

  useRealtime(`voting-${gameId}`, [
    {
      table: 'games', filter: `id=eq.${gameId}`,
      onUpdate: (row) => setGame(prev => prev ? { ...prev, ...(row as Partial<Game>) } : null),
    },
    {
      table: 'votes', filter: `game_id=eq.${gameId}`,
      onInsert: () => fetchTally(),
    },
  ], !!gameId);

  const fetchTally = async () => {
    const { data } = await supabase.from('votes').select('option_index').eq('game_id', gameId);
    if (data) {
      const t: VoteTally = {};
      data.forEach((v: { option_index: number }) => {
        t[v.option_index] = (t[v.option_index] || 0) + 1;
      });
      setTally(t);
      setTotalVotes(data.length);
    }
  };

  const castVote = async (optIdx: number) => {
    if (!profile || myVote !== null || voting) return;
    setVoting(true);
    const { error } = await supabase.from('votes').insert({
      game_id: gameId,
      user_id: profile.id,
      option_index: optIdx,
    });
    if (!error) {
      setMyVote(optIdx);
      showToast('투표가 완료되었습니다!', 'success');
      fetchTally();
    } else {
      showToast('이미 투표하셨습니다.', 'warning');
    }
    setVoting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  if (!game) return null;
  if (game.status === 'waiting') return <GameWaiting gameName={game.name} gameEmoji="🗳️" />;

  const options = game.config.options || [];
  const maxVotes = Math.max(...Object.values(tally), 1);

  if (game.status === 'ended') {
    const winner = options.reduce((best, _, idx) => (tally[idx] || 0) > (tally[best] || 0) ? idx : best, 0);
    return (
      <GameEnded
        gameName={game.name}
        summary={
          <div className="space-y-2">
            <p className="text-slate-600 text-sm mb-3">총 {totalVotes}명 투표 참여</p>
            {options.map((opt, idx) => {
              const votes = tally[idx] || 0;
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              const isWinner = idx === winner;
              return (
                <div key={idx} className={`rounded-xl p-3 ${isWinner ? 'bg-purple-100 border-2 border-purple-400' : 'bg-slate-50'}`}>
                  <div className="flex justify-between mb-1">
                    <span className={`font-semibold text-sm ${isWinner ? 'text-purple-700' : 'text-slate-700'}`}>
                      {isWinner ? '🏆 ' : ''}{opt}
                    </span>
                    <span className="text-sm font-bold text-slate-600">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full">
                    <div className={`h-full rounded-full ${isWinner ? 'bg-purple-500' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{votes}표</p>
                </div>
              );
            })}
          </div>
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 pt-6 pb-8">
        <button onClick={() => router.push('/')} className="text-violet-200 text-sm mb-3 block">← 뒤로</button>
        <h1 className="text-xl font-bold mb-1">🗳️ {game.name}</h1>
        <p className="text-violet-200 text-sm">총 {totalVotes}명 참여 중</p>
      </div>

      <div className="px-4 -mt-4 space-y-4 max-w-lg mx-auto">
        <div className="card">
          <p className="text-xs font-bold text-violet-500 mb-2 uppercase tracking-wide">투표 질문</p>
          <p className="font-bold text-slate-800 text-lg leading-relaxed">{game.config.question}</p>
        </div>

        <div className="space-y-3">
          {options.map((opt, idx) => {
            const votes = tally[idx] || 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isMyVote = myVote === idx;
            const isLeading = votes === maxVotes && votes > 0;

            return (
              <button
                key={idx}
                onClick={() => castVote(idx)}
                disabled={myVote !== null || voting || game.status !== 'playing'}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                  isMyVote
                    ? 'border-purple-500 bg-purple-50'
                    : myVote !== null
                    ? 'border-slate-200 bg-white opacity-70 cursor-default'
                    : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{opt}</span>
                    {isMyVote && <span className="badge badge-blue text-xs">내 투표</span>}
                    {isLeading && myVote !== null && <span className="badge badge-green text-xs">선두 🔥</span>}
                  </div>
                  {myVote !== null && (
                    <span className="text-sm font-bold text-slate-600">{pct}%</span>
                  )}
                </div>
                {myVote !== null && (
                  <>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isMyVote ? 'bg-purple-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{votes}표</p>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {myVote === null && (
          <div className="card bg-violet-50 border border-violet-200 text-center py-4">
            <p className="text-violet-700 font-medium">선택지를 클릭하여 투표하세요</p>
            <p className="text-violet-500 text-sm mt-1">한 번 선택하면 변경할 수 없습니다</p>
          </div>
        )}

        {myVote !== null && (
          <div className="card bg-green-50 border border-green-200 text-center py-4">
            <p className="text-green-700 font-semibold">✅ 투표 완료!</p>
            <p className="text-green-600 text-sm mt-1">결과가 실시간으로 업데이트됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
