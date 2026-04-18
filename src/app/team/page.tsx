'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';

interface TeamMember {
  id: string;
  name: string;
  is_online: boolean;
}

interface TeamData {
  id: string;
  name: string;
  color: string;
  total_score: number;
  members: TeamMember[];
}

export default function TeamPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [myTeam, setMyTeam] = useState<TeamData | null>(null);
  const [allTeams, setAllTeams] = useState<TeamData[]>([]);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (profile) fetchData();
  }, [profile, loading]);

  const fetchData = async () => {
    if (!profile) return;

    // All teams with members
    const { data: teams } = await supabase
      .from('teams')
      .select(`
        id, name, color, total_score,
        team_members(
          users(id, name, is_online)
        )
      `)
      .order('total_score', { ascending: false });

    if (teams) {
      const formatted = teams.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        name: t.name as string,
        color: t.color as string,
        total_score: t.total_score as number,
        members: ((t.team_members as Record<string, unknown>[]) || []).map(
          (tm: Record<string, unknown>) => (tm.users as TeamMember)
        ).filter(Boolean),
      }));
      setAllTeams(formatted);

      // Find my team
      const my = formatted.find(t => t.members.some(m => m.id === profile.id));
      setMyTeam(my || null);
    }
  };

  useEffect(() => {
        supabase.removeAllChannels();
    const channel = supabase.channel('team-rt');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, fetchData);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchData);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchData);
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 pt-6 pb-8">
        <h1 className="text-2xl font-bold mb-1">👥 팀</h1>
        <p className="text-violet-200 text-sm">팀 구성 및 점수 현황</p>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* My team card */}
        {myTeam ? (
          <div
            className="rounded-2xl p-4 text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${myTeam.color}, ${myTeam.color}cc)` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/70 text-xs font-medium">내 팀</p>
                <h2 className="text-xl font-bold">{myTeam.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">팀 점수</p>
                <p className="text-2xl font-bold">{myTeam.total_score.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {myTeam.members.map(m => (
                <div key={m.id} className="flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1">
                  <span className={`w-2 h-2 rounded-full ${m.is_online ? 'bg-green-400' : 'bg-white/40'}`} />
                  <span className="text-sm font-medium">{m.name}</span>
                  {m.id === profile?.id && <span className="text-white/70 text-xs">(나)</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card text-center py-8">
            <div className="text-3xl mb-2">🙋</div>
            <p className="font-semibold text-slate-600">아직 팀이 배정되지 않았습니다</p>
            <p className="text-sm text-slate-400 mt-1">관리자가 팀을 배정하면 여기에 표시됩니다</p>
          </div>
        )}

        {/* All teams */}
        <div>
          <h3 className="font-bold text-slate-700 mb-2">전체 팀 ({allTeams.length})</h3>
          <div className="space-y-2">
            {allTeams.map(team => (
              <div key={team.id} className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: team.color }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{team.name}</span>
                      {team.id === myTeam?.id && <span className="badge badge-blue text-xs">내 팀</span>}
                    </div>
                    <p className="text-xs text-slate-500">{team.members.length}명</p>
                  </div>
                  <span className="font-bold text-slate-800">{team.total_score.toLocaleString()}점</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {team.members.map(m => (
                    <span key={m.id} className="flex items-center gap-1 text-xs bg-slate-100 rounded-full px-2.5 py-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${m.is_online ? 'bg-green-400' : 'bg-slate-300'}`} />
                      {m.name}
                    </span>
                  ))}
                  {team.members.length === 0 && (
                    <span className="text-xs text-slate-400">팀원 없음</span>
                  )}
                </div>
              </div>
            ))}
            {allTeams.length === 0 && (
              <div className="card text-center py-8">
                <p className="text-slate-400">아직 팀이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav active="team" />
    </div>
  );
}
