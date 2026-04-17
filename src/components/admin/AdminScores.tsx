'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useRealtime } from '@/hooks/useRealtime';

interface LeaderEntry {
  id: string;
  name: string;
  team_name: string;
  team_color: string;
  total_score: number;
}

interface Game {
  id: string;
  name: string;
}

interface ScoreLog {
  id: string;
  user_name: string;
  game_name: string;
  points: number;
  reason: string | null;
  created_at: string;
}

export default function AdminScores() {
  const { showToast } = useToast();
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [logs, setLogs] = useState<ScoreLog[]>([]);

  // Form state
  const [userId, setUserId] = useState('');
  const [gameId, setGameId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  useRealtime('admin-scores-rt', [
    { table: 'scores', onChange: fetchAll },
    { table: 'teams',  onChange: fetchLeaderboard },
  ]);

  async function fetchAll() {
    await Promise.all([fetchLeaderboard(), fetchGames(), fetchLogs()]);
  };

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(50);
    if (data) setLeaderboard(data as unknown as LeaderEntry[]);
  };

  async function fetchGames() {
    const { data } = await supabase
      .from('games')
      .select('id, name')
      .order('created_at', { ascending: false });
    if (data) setGames(data);
  };

  async function fetchLogs() {
    const { data } = await supabase
      .from('scores')
      .select(`
        id,
        points,
        reason,
        created_at,
        users(name),
        games(name)
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) {
      setLogs(data.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        user_name: (s.users as { name: string } | null)?.name ?? '알 수 없음',
        game_name: (s.games as { name: string } | null)?.name ?? '-',
        points: s.points as number,
        reason: s.reason as string | null,
        created_at: s.created_at as string,
      })));
    }
  };

  const submitScore = async () => {
    if (!userId) { showToast('참가자를 선택하세요', 'warning'); return; }
    if (!gameId) { showToast('게임을 선택하세요', 'warning'); return; }
    const pts = parseInt(points);
    if (isNaN(pts) || pts === 0) { showToast('0이 아닌 점수를 입력하세요', 'warning'); return; }

    setSaving(true);

    const { data: tm } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .maybeSingle();

    const { error } = await supabase.from('scores').insert({
      user_id: userId,
      team_id: tm?.team_id ?? null,
      game_id: gameId,
      points: pts,
      reason: reason.trim() || '관리자 점수 조정',
    });

    if (error) {
      showToast('점수 추가 실패: ' + error.message, 'error');
      setSaving(false);
      return;
    }

    // Update team total
    if (tm?.team_id) {
      const { data: teamRow } = await supabase
        .from('teams').select('total_score').eq('id', tm.team_id).single();
      if (teamRow) {
        await supabase.from('teams')
          .update({ total_score: Math.max(0, teamRow.total_score + pts) })
          .eq('id', tm.team_id);
      }
    }

    const userName = leaderboard.find(u => u.id === userId)?.name ?? '';
    showToast(`${userName}에게 ${pts > 0 ? '+' : ''}${pts}점 적용!`, pts > 0 ? 'success' : 'info');
    setPoints('');
    setReason('');
    setSaving(false);
    fetchAll();
  };

  const deleteScore = async (id: string) => {
    if (!confirm('이 점수 기록을 삭제하시겠습니까?\n점수가 차감되지는 않습니다.')) return;
    await supabase.from('scores').delete().eq('id', id);
    showToast('삭제되었습니다', 'info');
    fetchAll();
  };

  const resetAllScores = async () => {
    if (!confirm('모든 점수를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) return;
    if (!confirm('정말로 모든 점수를 삭제하시겠습니까?')) return;
    await supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('teams').update({ total_score: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    showToast('모든 점수가 초기화되었습니다', 'info');
    fetchAll();
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const rankIcon = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-700">점수 관리</h2>
        <button onClick={resetAllScores} className="text-red-400 text-xs px-3 py-2 rounded-xl hover:bg-red-50 font-medium">
          전체 초기화
        </button>
      </div>

      {/* ── Manual score form ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">점수 수동 추가 / 차감</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">참가자</label>
            <select className="input text-sm" value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">참가자 선택...</option>
              {leaderboard.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}  ({u.team_name})  현재 {u.total_score.toLocaleString()}점
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">게임</label>
            <select className="input text-sm" value={gameId} onChange={e => setGameId(e.target.value)}>
              <option value="">게임 선택...</option>
              {games.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">점수 (음수 = 차감)</label>
              <input
                className="input text-sm"
                type="number"
                placeholder="예: 100 또는 -50"
                value={points}
                onChange={e => setPoints(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitScore()}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">사유 (선택)</label>
              <input
                className="input text-sm"
                placeholder="예: 보너스 점수"
                value={reason}
                onChange={e => setReason(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitScore()}
              />
            </div>
          </div>

          <button onClick={submitScore} disabled={saving} className="btn-primary w-full">
            {saving ? '처리 중...' : '점수 적용'}
          </button>
        </div>
      </div>

      {/* ── Live leaderboard ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">실시간 순위 (상위 10명)</h3>
        {leaderboard.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">점수 기록이 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {leaderboard.slice(0, 10).map((u, i) => (
              <div key={u.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-xl ${i < 3 ? 'bg-yellow-50' : ''}`}>
                <span className={`w-7 text-center font-bold text-sm ${
                  i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-400'
                }`}>
                  {rankIcon(i)}
                </span>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: u.team_color || '#94a3b8' }}
                />
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{u.name}</span>
                <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[80px]">{u.team_name}</span>
                <span className="font-bold text-slate-800 text-sm tabular-nums">
                  {u.total_score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Score log ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">최근 점수 기록 (30건)</h3>
        {logs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">기록이 없습니다</p>
        ) : (
          <div className="space-y-1">
            {logs.map(s => (
              <div key={s.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700">{s.user_name}</span>
                    <span className="text-xs text-slate-400">{s.game_name}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{s.reason ?? '–'} · {fmt(s.created_at)}</p>
                </div>
                <span className={`font-bold text-sm tabular-nums flex-shrink-0 ${
                  s.points >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {s.points >= 0 ? '+' : ''}{s.points}
                </span>
                <button
                  onClick={() => deleteScore(s.id)}
                  className="text-red-300 hover:text-red-500 text-sm p-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  title="삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
