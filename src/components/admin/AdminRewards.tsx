'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

interface Reward {
  id: string;
  rank: number;
  reward_name: string;
  description: string | null;
}

const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const rankIcon = (r: number) => RANK_ICONS[r] ?? `${r}위`;

export default function AdminRewards() {
  const { showToast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [rank, setRank] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRewards(); }, []);

  async function fetchRewards() {
    const { data } = await supabase.from('rewards').select('*').order('rank');
    if (data) setRewards(data);
  };

  const clearForm = () => { setEditId(null); setRank(''); setName(''); setDesc(''); };

  const openEdit = (r: Reward) => {
    setEditId(r.id); setRank(String(r.rank)); setName(r.reward_name); setDesc(r.description ?? '');
  };

  const save = async () => {
    if (!rank || !name.trim()) { showToast('순위와 상품명을 입력하세요', 'warning'); return; }
    const rankNum = parseInt(rank);
    if (isNaN(rankNum) || rankNum < 1) { showToast('올바른 순위를 입력하세요', 'warning'); return; }
    setSaving(true);

    if (editId) {
      const { error } = await supabase.from('rewards').update({
        rank: rankNum, reward_name: name.trim(), description: desc.trim() || null,
      }).eq('id', editId);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); }
      else { showToast('시상 내역이 수정되었습니다', 'success'); clearForm(); }
    } else {
      const { error } = await supabase.from('rewards').insert({
        rank: rankNum, reward_name: name.trim(), description: desc.trim() || null,
      });
      if (error) { showToast('추가 실패: ' + error.message, 'error'); }
      else { showToast('시상 내역이 추가되었습니다!', 'success'); clearForm(); }
    }

    setSaving(false);
    fetchRewards();
  };

  const remove = async (r: Reward) => {
    if (!confirm(`${rankIcon(r.rank)} "${r.reward_name}" 시상을 삭제하시겠습니까?`)) return;
    await supabase.from('rewards').delete().eq('id', r.id);
    showToast('삭제되었습니다', 'info');
    fetchRewards();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-700">시상 관리</h2>

      {/* Form */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">
          {editId ? '✏️ 시상 수정' : '🎁 새 시상 추가'}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">순위</label>
              <input className="input text-sm" type="number" min="1" placeholder="예: 1" value={rank} onChange={e => setRank(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">상품명</label>
              <input className="input text-sm" placeholder="예: 스타벅스 기프티콘" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">설명 (선택)</label>
            <input className="input text-sm" placeholder="예: 5만원 상당" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {editId && <button onClick={clearForm} className="btn-secondary flex-1">취소</button>}
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? '저장 중...' : editId ? '수정 저장' : '추가'}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {rewards.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          <div className="text-4xl mb-2">🎁</div>
          <p>시상 내역이 없습니다</p>
          <p className="text-sm mt-1">워크샵 상품을 등록하면 랭킹 화면에 표시됩니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
              <span className="text-3xl w-10 text-center flex-shrink-0">{rankIcon(r.rank)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{r.reward_name}</p>
                {r.description && <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(r)} className="text-blue-500 text-sm px-3 py-1.5 rounded-xl hover:bg-blue-50 font-medium">수정</button>
                <button onClick={() => remove(r)} className="text-red-400 text-sm px-2 py-1.5 rounded-xl hover:bg-red-50">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
