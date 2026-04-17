'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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
  isVisible: boolean;
  isClaimable: boolean;
}

interface Game {
  id: string;
  name: string;
  status: string;
}

export default function AdminTreasureEditorPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Form state for new/editing treasure
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [score, setScore] = useState(100);
  const [revealRadius, setRevealRadius] = useState(100);
  const [claimRadius, setClaimRadius] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) { router.push('/'); return; }
    if (isAdmin) {
      fetchGame();
      fetchTreasures();
    }
  }, [isAdmin, loading]);

  const fetchGame = async () => {
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (data) setGame(data as unknown as Game);
  };

  const fetchTreasures = async () => {
    const { data } = await supabase.from('treasures').select('*').eq('game_id', gameId);
    if (data) {
      setTreasures(data.map(t => ({ ...t, isVisible: true, isClaimable: false })));
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setPendingLocation({ lat, lng });
    setEditingId(null);
    setHint('');
    setScore(100);
    setRevealRadius(100);
    setClaimRadius(30);
  };

  const saveTreasure = async () => {
    if (!pendingLocation && !editingId) { alert('지도에서 위치를 클릭하세요'); return; }
    setSaving(true);

    if (editingId) {
      await supabase.from('treasures').update({
        hint, score, reveal_radius: revealRadius, claim_radius: claimRadius,
      }).eq('id', editingId);
    } else {
      await supabase.from('treasures').insert({
        game_id: gameId,
        lat: pendingLocation!.lat,
        lng: pendingLocation!.lng,
        hint: hint || null,
        score,
        reveal_radius: revealRadius,
        claim_radius: claimRadius,
        is_found: false,
      });
    }

    setSaving(false);
    setPendingLocation(null);
    setEditingId(null);
    setHint('');
    setScore(100);
    setRevealRadius(100);
    setClaimRadius(30);
    fetchTreasures();
  };

  const editTreasure = (t: Treasure) => {
    setEditingId(t.id);
    setPendingLocation(null);
    setHint(t.hint || '');
    setScore(t.score);
    setRevealRadius(t.reveal_radius);
    setClaimRadius(t.claim_radius);
  };

  const deleteTreasure = async (id: string) => {
    if (!confirm('이 보물을 삭제하시겠습니까?')) return;
    await supabase.from('treasures').delete().eq('id', id);
    fetchTreasures();
  };

  const resetFound = async (id: string) => {
    await supabase.from('treasures').update({
      is_found: false, found_by: null, found_at: null,
    }).eq('id', id);
    fetchTreasures();
  };

  // Preview marker for pending click
  const allMarkers = [
    ...treasures,
    ...(pendingLocation ? [{
      id: '__pending__',
      game_id: gameId,
      lat: pendingLocation.lat,
      lng: pendingLocation.lng,
      hint: '(새 보물 위치)',
      score,
      reveal_radius: revealRadius,
      claim_radius: claimRadius,
      is_found: false,
      found_by: null,
      isVisible: true,
      isClaimable: true, // show as highlight
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/admin')} className="text-slate-400 text-sm">← 관리자 패널</button>
        </div>
        <h1 className="text-lg font-bold">🗺️ 보물 편집기</h1>
        <p className="text-slate-400 text-sm">{game?.name}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Map */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
          <div className="p-3 border-b border-slate-100">
            <p className="text-sm text-slate-600 font-medium">
              📍 지도를 클릭하여 보물 위치를 추가하세요
            </p>
          </div>
          <div style={{ height: 350 }}>
            <TreasureMap
              treasures={allMarkers}
              userLocation={null}
              myUserId=""
              onMapClick={handleMapClick}
              isAdmin={true}
            />
          </div>
        </div>

        {/* Form - appears when location selected or editing */}
        {(pendingLocation || editingId) && (
          <div className="bg-white rounded-2xl p-4 border-2 border-amber-400 shadow-sm">
            <h3 className="font-bold text-amber-700 mb-3">
              {editingId ? '✏️ 보물 수정' : '➕ 새 보물 추가'}
            </h3>
            {pendingLocation && (
              <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-lg px-3 py-2">
                위치: {pendingLocation.lat.toFixed(6)}, {pendingLocation.lng.toFixed(6)}
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">힌트 (참가자에게 표시)</label>
                <input
                  className="input"
                  placeholder="예: 큰 나무 근처에 있어요"
                  value={hint}
                  onChange={e => setHint(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">점수: {score}점</label>
                <input
                  type="range" min="10" max="1000" step="10"
                  value={score}
                  onChange={e => setScore(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>10</span><span>1000</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  노출 반경: {revealRadius}m <span className="font-normal text-slate-400">(이 범위 내에서 지도에 표시)</span>
                </label>
                <input
                  type="range" min="50" max="500" step="10"
                  value={revealRadius}
                  onChange={e => setRevealRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>50m</span><span>500m</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  획득 반경: {claimRadius}m <span className="font-normal text-slate-400">(이 범위 내에서 획득 가능)</span>
                </label>
                <input
                  type="range" min="15" max="100" step="5"
                  value={claimRadius}
                  onChange={e => setClaimRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>15m</span><span>100m</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPendingLocation(null); setEditingId(null); }} className="btn-secondary flex-1">
                  취소
                </button>
                <button onClick={saveTreasure} disabled={saving} className="btn-primary flex-1">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Treasures list */}
        <div>
          <h3 className="font-bold text-slate-700 mb-2">보물 목록 ({treasures.length}개)</h3>
          {treasures.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400">
              아직 보물이 없습니다. 지도를 클릭하여 보물을 추가하세요.
            </div>
          ) : (
            <div className="space-y-2">
              {treasures.map((t, idx) => (
                <div key={t.id} className={`bg-white rounded-2xl p-4 border ${
                  t.is_found ? 'border-slate-200 opacity-60' : 'border-slate-100'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">보물 #{idx + 1}</span>
                        {t.is_found && <span className="badge badge-gray">발견됨</span>}
                      </div>
                      <p className="text-sm text-slate-500">{t.hint || '힌트 없음'}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        📍 {t.lat.toFixed(5)}, {t.lng.toFixed(5)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-600">{t.score}점</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <span>👁️ 노출: {t.reveal_radius}m</span>
                    <span>🎯 획득: {t.claim_radius}m</span>
                  </div>
                  <div className="flex gap-2">
                    {t.is_found && (
                      <button onClick={() => resetFound(t.id)} className="text-xs bg-orange-100 text-orange-600 px-2.5 py-1.5 rounded-lg hover:bg-orange-200">
                        ↺ 초기화
                      </button>
                    )}
                    {!t.is_found && (
                      <button onClick={() => editTreasure(t)} className="text-xs bg-blue-100 text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-200">
                        ✏️ 수정
                      </button>
                    )}
                    <button onClick={() => deleteTreasure(t.id)} className="text-xs bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-200">
                      🗑️ 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
