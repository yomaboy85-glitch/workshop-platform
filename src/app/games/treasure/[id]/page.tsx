'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { GameWaiting, GameEnded } from '@/components/GameStatus';
import { useRealtime } from '@/hooks/useRealtime';
import { haversineDistance, formatDistance, getCurrentPosition } from '@/lib/distance';
import { claimTreasure as claimTreasureRpc } from '@/lib/rpc';
import ScorePopup from '@/components/ScorePopup';
import dynamic from 'next/dynamic';

const TreasureMap = dynamic(() => import('@/components/TreasureMap'), { ssr: false });

interface Treasure {
  id: string;
  game_id: string;
  lat: number;
  lng: number;
  hint: string | null;
  score: number;
  reveal_radius: number;
  claim_radius: number;
  is_found: boolean;
  found_by: string | null;
}

interface TreasureState extends Treasure {
  distance?: number;
  isVisible: boolean;
  isClaimable: boolean;
}

interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'ended';
  config: Record<string, unknown>;
}

interface UserLocation { lat: number; lng: number; }

export default function TreasureGamePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const { showToast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [treasures, setTreasures] = useState<TreasureState[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [scorePopup, setScorePopup] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) { router.push('/login'); return; }
    init();
  }, [profile]);

  const init = async () => {
    const [{ data: g }, { data: t }, { data: tm }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('treasures').select('*').eq('game_id', gameId),
      supabase.from('team_members').select('team_id').eq('user_id', profile!.id).maybeSingle(),
    ]);
    if (g) setGame(g as unknown as Game);
    if (t) setTreasures(t.map(tr => ({ ...tr, isVisible: false, isClaimable: false })));
    if (tm) setMyTeamId(tm.team_id);
    setLoading(false);
  };

  useRealtime(`treasure-${gameId}`, [
    {
      table: 'games', filter: `id=eq.${gameId}`,
      onUpdate: (row) => setGame(prev => prev ? { ...prev, ...(row as Partial<Game>) } : null),
    },
    {
      table: 'treasures', filter: `game_id=eq.${gameId}`,
      onUpdate: (row) => {
        setTreasures(prev => prev.map(t =>
          t.id === (row as { id: string }).id
            ? { ...t, ...(row as Partial<TreasureState>) }
            : t
        ));
      },
    },
  ], !!gameId);

  const checkLocation = useCallback(async () => {
    setCheckingLocation(true);
    setLocationError('');
    setStatusMsg('');
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserLocation({ lat, lng });

      const updated = treasures.map(treasure => {
        if (treasure.is_found) return { ...treasure, isVisible: true, isClaimable: false };
        const dist = haversineDistance(lat, lng, treasure.lat, treasure.lng);
        return {
          ...treasure,
          distance: dist,
          isVisible: dist <= treasure.reveal_radius,
          isClaimable: dist <= treasure.claim_radius,
        };
      });
      setTreasures(updated);

      const claimable = updated.filter(t => t.isClaimable && !t.is_found);
      const visible = updated.filter(t => t.isVisible && !t.is_found && !t.isClaimable);

      if (claimable.length > 0) {
        setStatusMsg(`💎 보물이 바로 근처에 있습니다! (${claimable.length}개)`);
        showToast('보물이 근처에 있습니다!', 'success');
      } else if (visible.length > 0) {
        const closest = visible.reduce((a, b) => (a.distance! < b.distance! ? a : b));
        setStatusMsg(`👀 보물이 보입니다! ${formatDistance(closest.distance!)} 남았습니다`);
      } else {
        setStatusMsg('🔍 주변에 보물이 없습니다. 더 탐험해보세요!');
      }
    } catch {
      setLocationError('위치를 가져올 수 없습니다. 위치 권한을 허용해주세요.');
    } finally {
      setCheckingLocation(false);
    }
  }, [treasures, showToast]);

  const claimTreasure = async (treasureId: string) => {
    if (!profile || claimingId) return;
    setClaimingId(treasureId);

    const { data, error } = await claimTreasureRpc(treasureId, profile.id, myTeamId);

    if (error) {
      showToast('오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } else if (data?.success) {
      setScorePopup(data.score!);
      showToast(`🏆 보물 획득! +${data.score}점!`, 'success');
      setStatusMsg(`🏆 보물 획득! +${data.score}점!`);
      // Refresh treasures
      const { data: t } = await supabase.from('treasures').select('*').eq('game_id', gameId);
      if (t) setTreasures(prev =>
        t.map(tr => {
          const existing = prev.find(p => p.id === tr.id);
          return { ...tr, isVisible: existing?.isVisible || tr.is_found, isClaimable: false, distance: existing?.distance };
        })
      );
    } else {
      showToast(data?.message || '이미 찾은 보물입니다.', 'warning');
    }
    setClaimingId(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  if (!game) return null;
  if (game.status === 'waiting') return <GameWaiting gameName={game.name} gameEmoji="🗺️" />;

  const claimableTreasures = treasures.filter(t => t.isClaimable && !t.is_found);
  const foundCount = treasures.filter(t => t.is_found).length;
  const total = treasures.length;

  if (game.status === 'ended') {
    return (
      <GameEnded
        gameName={game.name}
        summary={
          <div className="bg-amber-50 rounded-2xl p-5">
            <p className="text-4xl font-bold text-amber-600">{foundCount} / {total}</p>
            <p className="text-slate-500 mt-1">보물 발견</p>
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

      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.push('/')} className="text-amber-200 text-sm">← 뒤로</button>
          <span className="font-bold">{game.name}</span>
          <span className="text-amber-200 text-sm">{foundCount}/{total} 발견</span>
        </div>
        {/* Found progress */}
        <div className="h-1.5 bg-amber-600/50 rounded-full mt-2">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? (foundCount / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="px-4 space-y-4 mt-4 max-w-lg mx-auto">
        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100" style={{ height: 300 }}>
          <TreasureMap
            treasures={treasures}
            userLocation={userLocation}
            myUserId={profile?.id || ''}
          />
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className={`card text-center font-semibold text-sm animate-fade-in ${
            statusMsg.includes('근처') || statusMsg.includes('획득')
              ? 'bg-yellow-50 border-2 border-yellow-400 text-yellow-800'
              : statusMsg.includes('보입니다')
              ? 'bg-blue-50 border border-blue-300 text-blue-700'
              : 'bg-slate-50 border border-slate-200 text-slate-600'
          }`}>
            {statusMsg}
          </div>
        )}

        {locationError && (
          <div className="card bg-red-50 border border-red-200 text-red-600 text-sm text-center">
            ⚠️ {locationError}
          </div>
        )}

        {/* Check location button */}
        <button
          onClick={checkLocation}
          disabled={checkingLocation}
          className="btn-primary w-full py-4 text-base"
        >
          {checkingLocation ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner" /> 위치 확인 중...
            </span>
          ) : '📍 현재 위치 확인하기'}
        </button>

        {/* Claimable treasures */}
        {claimableTreasures.length > 0 && (
          <div className="card bg-yellow-50 border-2 border-yellow-400 animate-fade-in">
            <h3 className="font-bold text-yellow-700 mb-3 flex items-center gap-2 text-base">
              <span className="text-xl">💎</span> 획득 가능한 보물!
            </h3>
            <div className="space-y-2.5">
              {claimableTreasures.map(t => (
                <div key={t.id} className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-700">{t.hint || '보물'}</p>
                    <p className="text-yellow-600 font-bold text-lg">{t.score}점</p>
                    {t.distance !== undefined && (
                      <p className="text-xs text-slate-400">{formatDistance(t.distance)} 거리</p>
                    )}
                  </div>
                  <button
                    onClick={() => claimTreasure(t.id)}
                    disabled={!!claimingId}
                    className="btn-success px-5 py-3 text-base"
                  >
                    {claimingId === t.id ? (
                      <span className="flex items-center gap-1"><span className="spinner" />획득 중</span>
                    ) : '🎁 획득!'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hint list */}
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-3">📋 보물 목록 ({total}개)</h3>
          <div className="space-y-2">
            {treasures.map((t, idx) => (
              <div key={t.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${
                t.is_found ? 'bg-slate-100' :
                t.isClaimable ? 'bg-yellow-50 border border-yellow-300' :
                t.isVisible ? 'bg-blue-50 border border-blue-200' :
                'bg-white border border-slate-100'
              }`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  t.is_found ? 'bg-slate-300 text-slate-500' :
                  t.isClaimable ? 'bg-yellow-400 text-white' :
                  t.isVisible ? 'bg-blue-400 text-white' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {t.is_found ? '✓' : t.isClaimable ? '💎' : t.isVisible ? '👀' : idx + 1}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${t.is_found ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {t.hint || `보물 #${idx + 1}`}
                  </p>
                  {t.is_found && (
                    <p className="text-xs text-slate-400">
                      {t.found_by === profile?.id ? '내가 발견! 🎉' : '다른 사람이 발견'}
                    </p>
                  )}
                  {t.isVisible && !t.is_found && t.distance !== undefined && (
                    <p className="text-xs text-blue-500">{formatDistance(t.distance)} 남음</p>
                  )}
                </div>
                <span className={`badge ${t.is_found ? 'badge-gray' : 'badge-yellow'}`}>{t.score}점</span>
              </div>
            ))}
            {total === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">아직 보물이 숨겨지지 않았습니다</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
