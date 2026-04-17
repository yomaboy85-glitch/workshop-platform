'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';

interface Game {
  id: string;
  name: string;
  type: string;
  status: 'waiting' | 'playing' | 'ended';
  config: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

type GameType = 'quiz' | 'mission' | 'timer' | 'voting' | 'treasure';

const DEFAULT_CONFIGS: Record<GameType, Record<string, unknown>> = {
  quiz: {
    timeLimit: 30,
    scorePerQuestion: 100,
    questions: [
      { text: '첫 번째 퀴즈 문제를 입력하세요', options: ['보기 1', '보기 2', '보기 3', '보기 4'], answer: 0, score: 100 },
    ],
  },
  mission: {
    scorePerMission: 50,
    missionList: [
      { title: '첫 번째 미션', description: '미션 설명을 입력하세요', score: 50 },
    ],
  },
  timer: {
    duration: 600,
    rules: '게임 규칙을 입력하세요',
    scoreOnComplete: 0,
  },
  voting: {
    question: '투표 질문을 입력하세요',
    options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
  },
  treasure: {
    description: '보물찾기 게임입니다. 보물은 지도 편집기에서 배치하세요.',
  },
};

const TYPE_LABELS: Record<string, string> = {
  quiz: '🧠 퀴즈',
  mission: '🎯 미션',
  timer: '⏱️ 타이머',
  voting: '🗳️ 투표',
  treasure: '🗺️ 보물찾기',
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  waiting: { label: '대기 중', cls: 'status-waiting' },
  playing: { label: '🔴 진행 중', cls: 'status-playing' },
  ended: { label: '종료', cls: 'status-ended' },
};

interface Props { onRefresh: () => void; }

export default function AdminGames({ onRefresh }: Props) {
  const { profile } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [games, setGames] = useState<Game[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<GameType>('quiz');
  const [formConfig, setFormConfig] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchGames(); }, []);

  async function fetchGames() {
    const { data } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setGames(data);
    onRefresh();
  };

  const openCreate = () => {
    setEditingGame(null);
    setFormName('');
    setFormType('quiz');
    setFormConfig(JSON.stringify(DEFAULT_CONFIGS['quiz'], null, 2));
    setJsonError('');
    setShowForm(true);
  };

  const openEdit = (game: Game) => {
    setEditingGame(game);
    setFormName(game.name);
    setFormType(game.type as GameType);
    setFormConfig(JSON.stringify(game.config, null, 2));
    setJsonError('');
    setShowForm(true);
  };

  const handleTypeChange = (t: GameType) => {
    setFormType(t);
    if (!editingGame) {
      setFormConfig(JSON.stringify(DEFAULT_CONFIGS[t], null, 2));
      setJsonError('');
    }
  };

  const validateJson = (val: string) => {
    try { JSON.parse(val); setJsonError(''); return true; }
    catch (e) { setJsonError(String(e)); return false; }
  };

  const saveGame = async () => {
    if (!formName.trim()) { showToast('게임 이름을 입력하세요', 'warning'); return; }
    if (!validateJson(formConfig)) return;
    const config = JSON.parse(formConfig);

    setSaving(true);
    if (editingGame) {
      const { error } = await supabase
        .from('games')
        .update({ name: formName, config })
        .eq('id', editingGame.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); setSaving(false); return; }
      showToast(`"${formName}" 게임이 수정되었습니다`, 'success');
    } else {
      const { error } = await supabase.from('games').insert({
        name: formName,
        type: formType,
        status: 'waiting',
        config,
        created_by: profile?.id || null,
      });
      if (error) { showToast('생성 실패: ' + error.message, 'error'); setSaving(false); return; }
      showToast(`"${formName}" 게임이 생성되었습니다!`, 'success');
    }

    setSaving(false);
    setShowForm(false);
    fetchGames();
  };

  const startGame = async (game: Game) => {
    if (games.some(g => g.status === 'playing' && g.id !== game.id)) {
      if (!confirm('이미 진행 중인 게임이 있습니다. 이 게임도 시작하시겠습니까?')) return;
    }
    await supabase.from('games').update({
      status: 'playing',
      started_at: new Date().toISOString(),
    }).eq('id', game.id);
    showToast(`"${game.name}" 게임 시작!`, 'success');
    fetchGames();
  };

  const endGame = async (game: Game) => {
    if (!confirm(`"${game.name}" 게임을 종료하시겠습니까?`)) return;
    await supabase.from('games').update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    }).eq('id', game.id);
    showToast(`"${game.name}" 게임이 종료되었습니다`, 'info');
    fetchGames();
  };

  const resetGame = async (game: Game) => {
    if (!confirm(`"${game.name}" 게임을 대기 상태로 초기화하시겠습니까?`)) return;
    await supabase.from('games').update({
      status: 'waiting',
      started_at: null,
      ended_at: null,
    }).eq('id', game.id);
    showToast(`"${game.name}" 게임이 초기화되었습니다`, 'info');
    fetchGames();
  };

  const deleteGame = async (game: Game) => {
    if (!confirm(`"${game.name}" 게임을 삭제하시겠습니까?\n관련 점수와 기록도 모두 삭제됩니다.`)) return;
    await supabase.from('games').delete().eq('id', game.id);
    showToast(`"${game.name}" 게임이 삭제되었습니다`, 'info');
    fetchGames();
  };

  const formatElapsed = (startedAt: string | null) => {
    if (!startedAt) return '';
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}분 ${s}초 경과`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-700">게임 목록 ({games.length})</h2>
        <button onClick={openCreate} className="btn-primary text-sm px-4 py-2">
          + 게임 추가
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-4 shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-bold text-slate-800">
                {editingGame ? '✏️ 게임 수정' : '➕ 새 게임 추가'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">게임 이름</label>
                <input
                  className="input"
                  placeholder="예: 1라운드 퀴즈"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  게임 타입 {editingGame && <span className="font-normal text-slate-400">(수정 불가)</span>}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TYPE_LABELS) as GameType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => !editingGame && handleTypeChange(t)}
                      disabled={!!editingGame}
                      className={`py-2.5 px-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                        formType === t
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-500'
                      } ${editingGame ? 'opacity-40 cursor-not-allowed' : 'hover:border-blue-300'}`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Config JSON */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">설정 (JSON)</label>
                  <button
                    onClick={() => { setFormConfig(JSON.stringify(DEFAULT_CONFIGS[formType], null, 2)); setJsonError(''); }}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    기본값으로 초기화
                  </button>
                </div>
                <textarea
                  className={`input font-mono text-xs h-56 resize-none ${jsonError ? 'border-red-400' : ''}`}
                  value={formConfig}
                  onChange={e => { setFormConfig(e.target.value); validateJson(e.target.value); }}
                  spellCheck={false}
                />
                {jsonError ? (
                  <p className="text-red-500 text-xs mt-1">⚠️ JSON 오류: {jsonError}</p>
                ) : (
                  <p className="text-slate-400 text-xs mt-1">JSON을 직접 편집하여 게임을 구성합니다</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">취소</button>
              <button onClick={saveGame} disabled={saving || !!jsonError} className="btn-primary flex-1">
                {saving ? '저장 중...' : editingGame ? '수정 저장' : '게임 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game list */}
      {games.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
          <div className="text-4xl mb-3">🎮</div>
          <p className="font-medium">게임이 없습니다</p>
          <p className="text-sm mt-1">+ 게임 추가 버튼을 눌러 시작하세요</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {games.map(game => {
            const sb = STATUS_BADGE[game.status];
            return (
              <div
                key={game.id}
                className={`bg-white rounded-2xl p-4 border shadow-sm ${
                  game.status === 'playing' ? 'border-green-300 bg-green-50/30' : 'border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-800 text-base">{game.name}</span>
                      <span className={sb.cls}>{sb.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">{TYPE_LABELS[game.type]}</span>
                      {game.status === 'playing' && game.started_at && (
                        <span className="text-xs text-green-600 font-medium">
                          · {formatElapsed(game.started_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {game.status === 'waiting' && (
                    <button
                      onClick={() => startGame(game)}
                      className="bg-green-500 text-white text-sm py-2 px-4 rounded-xl font-semibold hover:bg-green-600 active:scale-95 transition-all"
                    >
                      ▶ 시작
                    </button>
                  )}
                  {game.status === 'playing' && (
                    <button
                      onClick={() => endGame(game)}
                      className="bg-red-500 text-white text-sm py-2 px-4 rounded-xl font-semibold hover:bg-red-600 active:scale-95 transition-all"
                    >
                      ■ 종료
                    </button>
                  )}
                  {game.status === 'ended' && (
                    <button
                      onClick={() => resetGame(game)}
                      className="bg-slate-100 text-slate-600 text-sm py-2 px-4 rounded-xl font-semibold hover:bg-slate-200 active:scale-95 transition-all"
                    >
                      ↺ 재시작
                    </button>
                  )}
                  {game.type === 'treasure' && (
                    <button
                      onClick={() => router.push(`/admin/treasure/${game.id}`)}
                      className="bg-amber-100 text-amber-700 text-sm py-2 px-4 rounded-xl font-semibold hover:bg-amber-200 active:scale-95 transition-all"
                    >
                      🗺️ 보물 편집
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(game)}
                    className="bg-blue-50 text-blue-600 text-sm py-2 px-4 rounded-xl font-semibold hover:bg-blue-100 active:scale-95 transition-all"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    onClick={() => deleteGame(game)}
                    className="text-red-400 text-sm py-2 px-3 rounded-xl hover:bg-red-50 active:scale-95 transition-all"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
