'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useRealtime } from '@/hooks/useRealtime';

interface Participant {
  id: string;
  name: string;
  role: string;
  is_online: boolean;
  last_seen: string;
  team_name: string;
  team_color: string;
  total_score: number;
}

export default function AdminParticipants() {
  const { showToast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState('');
  const [filterOnline, setFilterOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  useRealtime('admin-participants-rt', [
    { table: 'users', onChange: fetchData },
    { table: 'team_members', onChange: fetchData },
    { table: 'scores', onChange: fetchData },
  ]);

  async function fetchData() {
    // Get leaderboard (includes team & score)
    const { data: lb } = await supabase.from('leaderboard').select('*');
    // Get online / last_seen from users table
    const { data: users } = await supabase
      .from('users')
      .select('id, is_online, last_seen, role');

    if (lb && users) {
      const map = new Map(users.map(u => [u.id, u]));
      const merged: Participant[] = lb.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        name: d.name as string,
        role: map.get(d.id as string)?.role ?? 'user',
        is_online: map.get(d.id as string)?.is_online ?? false,
        last_seen: map.get(d.id as string)?.last_seen ?? '',
        team_name: (d.team_name as string) ?? '무소속',
        team_color: (d.team_color as string) ?? '#94a3b8',
        total_score: (d.total_score as number) ?? 0,
      }));
      setParticipants(merged);
    }
    setLoading(false);
  };

  const deleteUser = async (p: Participant) => {
    if (!confirm(`"${p.name}" 참가자를 삭제하시겠습니까?\n점수, 팀 배정 기록도 함께 삭제됩니다.`)) return;
    // Cascade: RLS + FK ON DELETE CASCADE handles related rows
    const { error } = await supabase.from('users').delete().eq('id', p.id);
    if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
    showToast(`"${p.name}" 참가자가 삭제되었습니다`, 'info');
    fetchData();
  };

  const fmtLastSeen = (iso: string) => {
    if (!iso) return '–';
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    return `${Math.floor(s / 86400)}일 전`;
  };

  const visible = participants
    .filter(p => p.role !== 'admin')
    .filter(p => !filterOnline || p.is_online)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const onlineCount = participants.filter(p => p.is_online && p.role !== 'admin').length;
  const totalCount = participants.filter(p => p.role !== 'admin').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-700">참가자 관리</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            전체 {totalCount}명 ·
            <span className="text-green-600 font-medium"> 🟢 {onlineCount}명 온라인</span>
          </p>
        </div>
        <button
          onClick={fetchData}
          className="text-blue-500 text-xs px-3 py-2 rounded-xl hover:bg-blue-50 font-medium"
        >
          새로고침
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm py-2.5"
          placeholder="이름 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={() => setFilterOnline(f => !f)}
          className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            filterOnline
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          🟢 온라인
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          {search || filterOnline ? '검색 결과가 없습니다' : '참가자가 없습니다'}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p, idx) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl px-4 py-3 border border-slate-100 flex items-center gap-3"
            >
              {/* Rank */}
              <span className="w-5 text-center text-xs text-slate-400 font-medium flex-shrink-0">
                {idx + 1}
              </span>

              {/* Avatar with online dot */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  p.is_online ? 'bg-green-400' : 'bg-slate-300'
                }`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.team_color }}
                  />
                  <span className="text-xs text-slate-500 truncate">{p.team_name}</span>
                  <span className="text-slate-300 text-xs">·</span>
                  <span className="text-xs text-slate-400">{fmtLastSeen(p.last_seen)}</span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-800 text-sm tabular-nums">
                  {p.total_score.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">점</p>
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteUser(p)}
                className="text-red-300 hover:text-red-500 text-sm p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                title="참가자 삭제"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
