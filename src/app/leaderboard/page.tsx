'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';

interface LeaderboardEntry {
  id: string;
  name: string;
  team_name: string;
  team_color: string;
  total_score: number;
}

interface TeamEntry {
  id: string;
  name: string;
  color: string;
  member_count: number;
  total_score: number;
}

interface Reward {
  rank: number;
  reward_name: string;
}

export default function LeaderboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'individual' | 'team'>('individual');
  const [individuals, setIndividuals] = useState<LeaderboardEntry[]>([]);
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (profile) fetchData();
  }, [profile, loading]);

  const fetchData = async () => {
    const [{ data: lb }, { data: tb }, { data: rw }] = await Promise.all([
      supabase.from('leaderboard').select('*').limit(50),
      supabase.from('team_leaderboard').select('*').limit(20),
      supabase.from('rewards').select('*').order('rank'),
    ]);
    if (lb) setIndividuals(lb);
    if (tb) setTeams(tb);
    if (rw) setRewards(rw);
  };

  useEffect(() => {
        supabase.removeAllChannels();
    const channel = supabase.channel('leaderboard-rt');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, fetchData);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchData);
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const rankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}위`;
  };

  const getRewardForRank = (rank: number) => rewards.find(r => r.rank === rank);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 pt-6 pb-8">
        <h1 className="text-2xl font-bold mb-1">🏆 랭킹</h1>
        <p className="text-yellow-100 text-sm">실시간 점수 현황</p>
      </div>

      <div className="px-4 -mt-4">
        {/* Tab switcher */}
        <div className="flex bg-white rounded-2xl p-1 mb-4 shadow-sm border border-slate-100">
          <button
            onClick={() => setTab('individual')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'individual' ? 'bg-yellow-400 text-white shadow' : 'text-slate-500'
            }`}
          >
            개인 순위
          </button>
          <button
            onClick={() => setTab('team')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'team' ? 'bg-yellow-400 text-white shadow' : 'text-slate-500'
            }`}
          >
            팀 순위
          </button>
        </div>

        {/* Rewards section */}
        {rewards.length > 0 && (
          <div className="card mb-4">
            <h3 className="font-bold text-slate-700 mb-2 text-sm">🎁 시상 내역</h3>
            <div className="space-y-1.5">
              {rewards.map(r => (
                <div key={r.rank} className="flex items-center gap-2">
                  <span className="text-base">{rankIcon(r.rank)}</span>
                  <span className="text-sm font-medium text-slate-700">{r.reward_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual leaderboard */}
        {tab === 'individual' && (
          <div className="space-y-2">
            {individuals.map((entry, idx) => {
              const rank = idx + 1;
              const reward = getRewardForRank(rank);
              const isMe = entry.id === profile?.id;
              return (
                <div
                  key={entry.id}
                  className={`card flex items-center gap-3 ${isMe ? 'border-blue-300 bg-blue-50' : ''} ${
                    rank <= 3 ? 'border-yellow-200 bg-yellow-50/50' : ''
                  }`}
                >
                  <div className="w-10 text-center">
                    <span className={`font-bold text-lg ${
                      rank === 1 ? 'text-yellow-500' :
                      rank === 2 ? 'text-slate-400' :
                      rank === 3 ? 'text-orange-400' : 'text-slate-500'
                    }`}>
                      {rank <= 3 ? rankIcon(rank) : rank}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{entry.name}</span>
                      {isMe && <span className="badge badge-blue text-xs">나</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.team_color || '#94a3b8' }}
                      />
                      <span className="text-xs text-slate-500">{entry.team_name}</span>
                    </div>
                    {reward && (
                      <span className="text-xs text-yellow-600 font-medium">🎁 {reward.reward_name}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-800">
                      {entry.total_score.toLocaleString()}
                    </span>
                    <p className="text-xs text-slate-400">점</p>
                  </div>
                </div>
              );
            })}
            {individuals.length === 0 && (
              <div className="card text-center py-10">
                <p className="text-slate-400">아직 점수 기록이 없습니다</p>
              </div>
            )}
          </div>
        )}

        {/* Team leaderboard */}
        {tab === 'team' && (
          <div className="space-y-2">
            {teams.map((team, idx) => {
              const rank = idx + 1;
              return (
                <div key={team.id} className="card flex items-center gap-3">
                  <div className="w-10 text-center">
                    <span className={`font-bold text-lg ${
                      rank === 1 ? 'text-yellow-500' :
                      rank === 2 ? 'text-slate-400' :
                      rank === 3 ? 'text-orange-400' : 'text-slate-500'
                    }`}>
                      {rank <= 3 ? rankIcon(rank) : rank}
                    </span>
                  </div>
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: team.color }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-slate-800">{team.name}</span>
                    <p className="text-xs text-slate-500">{team.member_count}명</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-800">
                      {team.total_score.toLocaleString()}
                    </span>
                    <p className="text-xs text-slate-400">점</p>
                  </div>
                </div>
              );
            })}
            {teams.length === 0 && (
              <div className="card text-center py-10">
                <p className="text-slate-400">아직 팀이 없습니다</p>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav active="leaderboard" />
    </div>
  );
}
