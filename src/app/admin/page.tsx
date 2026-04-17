'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/hooks/useRealtime';
import AdminGames from '@/components/admin/AdminGames';
import AdminTeams from '@/components/admin/AdminTeams';
import AdminScores from '@/components/admin/AdminScores';
import AdminAnnouncements from '@/components/admin/AdminAnnouncements';
import AdminParticipants from '@/components/admin/AdminParticipants';
import AdminRewards from '@/components/admin/AdminRewards';

type Tab = 'games' | 'teams' | 'scores' | 'announcements' | 'participants' | 'rewards';

interface Stats {
  users: number;
  onlineUsers: number;
  teams: number;
  games: number;
  activeGameName: string | null;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'games',         label: '게임',   icon: '🎮' },
  { key: 'teams',         label: '팀',     icon: '👥' },
  { key: 'scores',        label: '점수',   icon: '📊' },
  { key: 'announcements', label: '공지',   icon: '📢' },
  { key: 'participants',  label: '참가자', icon: '🙋' },
  { key: 'rewards',       label: '시상',   icon: '🎁' },
];

export default function AdminPage() {
  const { profile, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('games');
  const [stats, setStats] = useState<Stats>({
    users: 0, onlineUsers: 0, teams: 0, games: 0, activeGameName: null,
  });

  useEffect(() => {
    if (!loading && !profile) { router.push('/login'); return; }
    if (!loading && !isAdmin)  { router.push('/');      return; }
    if (isAdmin) fetchStats();
  }, [profile, loading, isAdmin]);

  useRealtime('admin-stats', [
    { table: 'users',  onChange: fetchStats },
    { table: 'games',  onChange: fetchStats },
    { table: 'teams',  onChange: fetchStats },
  ], !!isAdmin);

  async function fetchStats() {
    const [
      { count: userCount },
      { count: onlineCount },
      { count: teamCount },
      { data: gamesData },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user').eq('is_online', true),
      supabase.from('teams').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('id, name, status').order('created_at', { ascending: false }),
    ]);

    setStats({
      users: userCount ?? 0,
      onlineUsers: onlineCount ?? 0,
      teams: teamCount ?? 0,
      games: gamesData?.length ?? 0,
      activeGameName: gamesData?.find(g => g.status === 'playing')?.name ?? null,
    });
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="spinner border-slate-600 border-t-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Sticky Admin Header ── */}
      <div className="bg-slate-900 text-white sticky top-0 z-40">
        {/* Top bar */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <h1 className="text-base font-bold">관리자 패널</h1>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">{profile?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                참가자 뷰 →
              </button>
              <button
                onClick={signOut}
                className="text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: '참가자', value: stats.users, sub: `${stats.onlineUsers}명 온라인` },
              { label: '팀',     value: stats.teams, sub: '개 팀' },
              { label: '게임',   value: stats.games, sub: '개 등록' },
              { label: '진행중', value: stats.activeGameName ? '▶' : '–', sub: stats.activeGameName ?? '없음' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-xl p-2.5 text-center">
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-slate-400 text-[10px] mt-1">{s.label}</p>
                <p className="text-slate-500 text-[10px] truncate">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Active game banner */}
          {stats.activeGameName && (
            <div className="bg-green-900/40 border border-green-700 rounded-xl px-3 py-2 mb-3 text-center">
              <p className="text-green-400 text-xs font-semibold">
                🔴 진행 중: {stats.activeGameName}
              </p>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="p-4 max-w-2xl mx-auto">
        {activeTab === 'games'         && <AdminGames onRefresh={fetchStats} />}
        {activeTab === 'teams'         && <AdminTeams />}
        {activeTab === 'scores'        && <AdminScores />}
        {activeTab === 'announcements' && <AdminAnnouncements />}
        {activeTab === 'participants'  && <AdminParticipants />}
        {activeTab === 'rewards'       && <AdminRewards />}
      </div>
    </div>
  );
}
