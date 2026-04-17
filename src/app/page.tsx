'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import GameCard from '@/components/GameCard';
import PresenceIndicator from '@/components/PresenceIndicator';

interface Game {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
}

interface TeamInfo {
  name: string;
  color: string;
}

interface UserScore {
  total: number;
}

export default function HomePage() {
  const { profile, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [userScore, setUserScore] = useState(0);

  useEffect(() => {
    if (!loading && !profile) {
      router.push('/login');
      return;
    }
    if (!loading && isAdmin) {
      router.push('/admin');
      return;
    }
    if (profile) {
      fetchData();
      subscribeToGames();
    }
  }, [profile, loading, isAdmin]);

  const fetchData = async () => {
    if (!profile) return;

    // Fetch active games
    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .neq('status', 'ended')
      .order('created_at', { ascending: false });
    if (gamesData) setGames(gamesData);

    // Fetch team info
    const { data: tmData } = await supabase
      .from('team_members')
      .select('teams(name, color)')
      .eq('user_id', profile.id)
      .single();
    if (tmData?.teams) setTeamInfo(tmData.teams as unknown as TeamInfo);

    // Fetch user score
    const { data: scoresData } = await supabase
      .from('scores')
      .select('points')
      .eq('user_id', profile.id);
    if (scoresData) {
      setUserScore(scoresData.reduce((sum, s) => sum + s.points, 0));
    }
  };

  const subscribeToGames = () => {
    const channel = supabase
      .channel('games-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-3" />
          <p className="text-slate-500 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  const gameTypeLabel: Record<string, string> = {
    quiz: '🧠 퀴즈',
    mission: '🎯 미션',
    timer: '⏱️ 타이머',
    voting: '🗳️ 투표',
    treasure: '🗺️ 보물찾기',
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AnnouncementBanner />

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 pt-safe pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-200 text-sm">안녕하세요 👋</p>
            <h1 className="text-xl font-bold">{profile?.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-xs">내 점수</p>
            <p className="text-2xl font-bold">{userScore.toLocaleString()}</p>
            <PresenceIndicator />
          </div>
        </div>

        {/* Team badge */}
        {teamInfo ? (
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-2xl px-4 py-2.5 w-fit">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamInfo.color }} />
            <span className="text-sm font-semibold">{teamInfo.name}</span>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur rounded-2xl px-4 py-2.5 w-fit">
            <span className="text-sm text-blue-200">팀 미배정</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 -mt-4">
        <div className="card mb-4">
          <h2 className="font-bold text-slate-800 mb-1">진행 중인 게임</h2>
          <p className="text-slate-500 text-sm">{games.length}개의 게임이 준비되어 있습니다</p>
        </div>

        {games.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">🎮</div>
            <p className="text-slate-500 font-medium">아직 진행 중인 게임이 없습니다</p>
            <p className="text-slate-400 text-sm mt-1">관리자가 게임을 시작하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map(game => (
              <GameCard
                key={game.id}
                game={game}
                typeLabel={gameTypeLabel[game.type] || game.type}
                onClick={() => router.push(`/games/${game.type}/${game.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav active="home" />
    </div>
  );
}
