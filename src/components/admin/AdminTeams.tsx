'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

interface Team {
  id: string;
  name: string;
  color: string;
  total_score: number;
}

interface User {
  id: string;
  name: string;
  is_online: boolean;
}

interface TeamWithMembers extends Team {
  members: User[];
}

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#a855f7', '#f43f5e',
];

export default function AdminTeams() {
  const { showToast } = useToast();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [unassigned, setUnassigned] = useState<User[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [bulkCount, setBulkCount] = useState('3');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [{ data: teamsData }, { data: allUsers }, { data: membersData }] = await Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('users').select('id, name, is_online').eq('role', 'user').order('name'),
      supabase.from('team_members').select('user_id, team_id, users(id, name, is_online)'),
    ]);

    const assignedIds = new Set((membersData || []).map(m => m.user_id));
    setUnassigned((allUsers || []).filter(u => !assignedIds.has(u.id)));

    const formatted: TeamWithMembers[] = (teamsData || []).map(t => ({
      ...t,
      members: (membersData || [])
        .filter(m => m.team_id === t.id)
        .map(m => m.users as unknown as User)
        .filter(Boolean),
    }));
    setTeams(formatted);
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('teams').insert({
      name: newTeamName.trim(),
      color: newTeamColor,
      total_score: 0,
    });
    if (error) { showToast('팀 생성 실패: ' + error.message, 'error'); }
    else { showToast(`"${newTeamName}" 팀이 생성되었습니다!`, 'success'); }
    setNewTeamName('');
    setSaving(false);
    fetchData();
  };

  const createBulkTeams = async () => {
    const count = parseInt(bulkCount);
    if (isNaN(count) || count < 2 || count > 20) {
      showToast('2~20 사이의 숫자를 입력하세요', 'warning');
      return;
    }
    setSaving(true);
    const inserts = Array.from({ length: count }, (_, i) => ({
      name: `팀 ${i + 1}`,
      color: PRESET_COLORS[i % PRESET_COLORS.length],
      total_score: 0,
    }));
    await supabase.from('teams').insert(inserts);
    showToast(`${count}개 팀이 생성되었습니다!`, 'success');
    setSaving(false);
    fetchData();
  };

  const deleteTeam = async (id: string, name: string) => {
    if (!confirm(`"${name}" 팀을 삭제하면 팀원들이 무소속이 됩니다. 계속하시겠습니까?`)) return;
    await supabase.from('team_members').delete().eq('team_id', id);
    await supabase.from('teams').delete().eq('id', id);
    showToast(`"${name}" 팀이 삭제되었습니다`, 'info');
    fetchData();
  };

  const moveUser = async (userId: string, teamId: string | null) => {
    await supabase.from('team_members').delete().eq('user_id', userId);
    if (teamId) {
      await supabase.from('team_members').insert({ user_id: userId, team_id: teamId });
    }
    fetchData();
  };

  const randomAssign = async () => {
    if (teams.length === 0) { showToast('먼저 팀을 생성하세요', 'warning'); return; }
    const allUnassigned = unassigned;
    if (allUnassigned.length === 0) { showToast('배정할 미배정 참가자가 없습니다', 'warning'); return; }
    if (!confirm(`${allUnassigned.length}명을 ${teams.length}개 팀에 무작위 배정하시겠습니까?`)) return;

    // Shuffle
    const shuffled = [...allUnassigned].sort(() => Math.random() - 0.5);
    const inserts = shuffled.map((u, i) => ({
      user_id: u.id,
      team_id: teams[i % teams.length].id,
    }));

    await supabase.from('team_members').upsert(inserts, { onConflict: 'user_id' });
    showToast(`${allUnassigned.length}명 무작위 배정 완료!`, 'success');
    fetchData();
  };

  const randomAssignAll = async () => {
    if (teams.length === 0) { showToast('먼저 팀을 생성하세요', 'warning'); return; }
    const { data: allUsers } = await supabase.from('users').select('id').eq('role', 'user');
    if (!allUsers || allUsers.length === 0) { showToast('참가자가 없습니다', 'warning'); return; }
    if (!confirm(`전체 ${allUsers.length}명을 ${teams.length}개 팀에 재배정하시겠습니까? 기존 배정이 모두 초기화됩니다.`)) return;

    // Clear all
    await supabase.from('team_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Shuffle and assign
    const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
    const inserts = shuffled.map((u, i) => ({
      user_id: u.id,
      team_id: teams[i % teams.length].id,
    }));
    await supabase.from('team_members').insert(inserts);
    showToast(`전체 ${allUsers.length}명 재배정 완료!`, 'success');
    fetchData();
  };

  const resetAllTeams = async () => {
    if (!confirm('모든 팀 배정을 초기화하시겠습니까?')) return;
    await supabase.from('team_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    showToast('팀 배정이 초기화되었습니다', 'info');
    fetchData();
  };

  const deleteAllTeams = async () => {
    if (!confirm('모든 팀과 배정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    await supabase.from('team_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    showToast('모든 팀이 삭제되었습니다', 'info');
    fetchData();
  };

  const totalAssigned = teams.reduce((s, t) => s + t.members.length, 0);
  const totalParticipants = totalAssigned + unassigned.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-700">팀 관리</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {teams.length}개 팀 · 전체 {totalParticipants}명 · 배정됨 {totalAssigned}명 · 미배정 {unassigned.length}명
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {unassigned.length > 0 && (
            <button onClick={randomAssign} className="bg-emerald-100 text-emerald-700 text-xs px-3 py-2 rounded-xl font-semibold hover:bg-emerald-200">
              🎲 미배정 무작위
            </button>
          )}
          {totalParticipants > 0 && teams.length > 0 && (
            <button onClick={randomAssignAll} className="bg-blue-100 text-blue-700 text-xs px-3 py-2 rounded-xl font-semibold hover:bg-blue-200">
              🔀 전체 재배정
            </button>
          )}
          {totalAssigned > 0 && (
            <button onClick={resetAllTeams} className="bg-orange-100 text-orange-600 text-xs px-3 py-2 rounded-xl font-semibold hover:bg-orange-200">
              ↺ 배정 초기화
            </button>
          )}
          {teams.length > 0 && (
            <button onClick={deleteAllTeams} className="bg-red-100 text-red-600 text-xs px-3 py-2 rounded-xl font-semibold hover:bg-red-200">
              🗑️ 전체 삭제
            </button>
          )}
        </div>
      </div>

      {/* Create team */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">새 팀 추가</h3>

        {/* Single team */}
        <div className="flex gap-2 mb-3">
          <input
            className="input flex-1 py-2 text-sm"
            placeholder="팀 이름 입력"
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTeam()}
          />
          <button onClick={createTeam} disabled={saving || !newTeamName.trim()} className="btn-primary px-4 text-sm py-2">
            추가
          </button>
        </div>

        {/* Color picker */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewTeamColor(c)}
              className={`w-7 h-7 rounded-full flex-shrink-0 transition-all ${
                newTeamColor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Bulk create */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 mb-2">팀 N개 한번에 생성 (팀 1, 팀 2, ...)</p>
          <div className="flex gap-2">
            <input
              className="input w-20 py-2 text-sm text-center"
              type="number"
              min="2"
              max="20"
              value={bulkCount}
              onChange={e => setBulkCount(e.target.value)}
            />
            <button onClick={createBulkTeams} disabled={saving} className="btn-secondary text-sm py-2 px-4">
              {bulkCount}개 팀 생성
            </button>
          </div>
        </div>
      </div>

      {/* Unassigned users */}
      {unassigned.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-orange-200 bg-orange-50">
          <h3 className="font-semibold text-orange-700 mb-2 text-sm flex items-center gap-2">
            <span>⚠️</span> 미배정 참가자 ({unassigned.length}명)
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(u => (
              <div key={u.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.is_online ? 'bg-green-400' : 'bg-slate-300'}`} />
                <span className="text-sm text-slate-700 font-medium">{u.name}</span>
                {teams.length > 0 && (
                  <select
                    className="text-xs text-blue-600 bg-transparent border-none outline-none ml-0.5 cursor-pointer max-w-[80px]"
                    value=""
                    onChange={e => e.target.value && moveUser(u.id, e.target.value)}
                  >
                    <option value="">→ 배정</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams */}
      {teams.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          <div className="text-4xl mb-3">👥</div>
          <p>팀이 없습니다. 새 팀을 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              {/* Team header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                  style={{ backgroundColor: team.color }}
                >
                  {team.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 truncate">{team.name}</span>
                    <span className="badge badge-gray text-xs flex-shrink-0">{team.members.length}명</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-slate-700 text-sm">{team.total_score.toLocaleString()}점</span>
                  <button
                    onClick={() => deleteTeam(team.id, team.name)}
                    className="text-red-400 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="팀 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {team.members.map(m => (
                    <div key={m.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 group">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.is_online ? 'bg-green-400' : 'bg-slate-300'}`} />
                      <span className="text-xs text-slate-700 font-medium">{m.name}</span>
                      <button
                        onClick={() => moveUser(m.id, null)}
                        className="text-slate-300 hover:text-red-500 text-xs ml-0.5 transition-colors opacity-0 group-hover:opacity-100"
                        title="팀에서 제거"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {team.members.length === 0 && (
                    <span className="text-xs text-slate-400 italic">팀원 없음</span>
                  )}
                </div>

                {/* Quick add from unassigned */}
                {unassigned.length > 0 && (
                  <select
                    className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:bg-blue-100 transition-colors"
                    value=""
                    onChange={e => e.target.value && moveUser(e.target.value, team.id)}
                  >
                    <option value="">+ 팀원 추가 ({unassigned.length}명 미배정)</option>
                    {unassigned.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.is_online ? '🟢' : '⚫'} {u.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
