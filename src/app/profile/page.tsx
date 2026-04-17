'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';

interface ScoreEntry {
  id: string;
  points: number;
  reason: string | null;
  created_at: string;
  games: { name: string } | null;
}

export default function ProfilePage() {
  const { profile, signOut, loading } = useAuth();
  const router = useRouter();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (profile) fetchData();
  }, [profile, loading]);

  const fetchData = async () => {
    if (!profile) return;
    const [{ data: scoreData }, { data: teamData }] = await Promise.all([
      supabase
        .from('scores')
        .select('*, games(name)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('team_members')
        .select('teams(name)')
        .eq('user_id', profile.id)
        .single(),
    ]);

    if (scoreData) {
      setScores(scoreData as unknown as ScoreEntry[]);
      setTotalScore(scoreData.reduce((sum, s) => sum + s.points, 0));
    }
    if (teamData?.teams) setTeamName((teamData.teams as unknown as { name: string }).name);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 pt-6 pb-12">
        <h1 className="text-2xl font-bold mb-1">👤 내 정보</h1>
        <p className="text-slate-400 text-sm">점수 기록 및 계정 정보</p>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        {/* Profile card */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl text-white font-bold">
              {profile?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">{profile?.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${profile?.role === 'admin' ? 'badge-red' : 'badge-blue'}`}>
                  {profile?.role === 'admin' ? '관리자' : '참가자'}
                </span>
                {teamName && <span className="badge badge-green">{teamName}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-600">{totalScore.toLocaleString()}</p>
            <p className="text-slate-500 text-sm mt-1">총 점수</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-emerald-600">{scores.length}</p>
            <p className="text-slate-500 text-sm mt-1">획득 기록</p>
          </div>
        </div>

        {/* Score history */}
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-3">📊 점수 기록</h3>
          {scores.length > 0 ? (
            <div className="space-y-2">
              {scores.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.reason || '점수 획득'}</p>
                    <p className="text-xs text-slate-400">
                      {s.games?.name && `${s.games.name} · `}{formatDate(s.created_at)}
                    </p>
                  </div>
                  <span className={`font-bold ${s.points >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.points >= 0 ? '+' : ''}{s.points}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-4">아직 점수 기록이 없습니다</p>
          )}
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut} className="btn-danger w-full">
          로그아웃
        </button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
