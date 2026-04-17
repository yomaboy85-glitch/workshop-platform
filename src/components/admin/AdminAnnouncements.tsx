'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { useRealtime } from '@/hooks/useRealtime';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'banner' | 'modal';
  is_active: boolean;
  created_at: string;
}

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'banner' | 'modal'>('banner');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  useRealtime('admin-announcements', [
    { table: 'announcements', onChange: fetchData },
  ]);

  async function fetchData() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAnnouncements(data);
  };

  const create = async () => {
    if (!title.trim()) { showToast('제목을 입력하세요', 'warning'); return; }
    setSaving(true);
    const { error } = await supabase.from('announcements').insert({
      title: title.trim(),
      content: content.trim(),
      type,
      is_active: true,
      created_by: profile?.id ?? null,
    });
    if (error) { showToast('공지 작성 실패: ' + error.message, 'error'); }
    else { showToast('공지가 발송되었습니다!', 'success'); setTitle(''); setContent(''); }
    setSaving(false);
    fetchData();
  };

  const toggle = async (a: Announcement) => {
    await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id);
    showToast(a.is_active ? '공지가 비활성화되었습니다' : '공지가 활성화되었습니다', 'info');
    fetchData();
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`"${a.title}" 공지를 삭제하시겠습니까?`)) return;
    await supabase.from('announcements').delete().eq('id', a.id);
    showToast('공지가 삭제되었습니다', 'info');
    fetchData();
  };

  const deactivateAll = async () => {
    await supabase.from('announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    showToast('모든 공지가 비활성화되었습니다', 'info');
    fetchData();
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const activeCount = announcements.filter(a => a.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-700">공지 관리</h2>
          {activeCount > 0 && (
            <p className="text-xs text-green-600 mt-0.5 font-medium">현재 {activeCount}개 공지 활성 중</p>
          )}
        </div>
        {activeCount > 0 && (
          <button onClick={deactivateAll} className="text-slate-500 text-xs px-3 py-2 rounded-xl hover:bg-slate-100 font-medium">
            전체 비활성화
          </button>
        )}
      </div>

      {/* Create form */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">새 공지 작성</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">제목</label>
            <input
              className="input"
              placeholder="공지 제목 입력"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">내용</label>
            <textarea
              className="input h-20 resize-none"
              placeholder="공지 내용 (선택사항)"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">표시 방식</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('banner')}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  type === 'banner'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-lg block mb-1">📌</span>
                상단 배너
                <span className="block text-xs font-normal mt-0.5 opacity-70">화면 위에 고정</span>
              </button>
              <button
                onClick={() => setType('modal')}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  type === 'modal'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-lg block mb-1">💬</span>
                팝업 모달
                <span className="block text-xs font-normal mt-0.5 opacity-70">중앙 팝업 표시</span>
              </button>
            </div>
          </div>
          <button onClick={create} disabled={saving} className="btn-primary w-full py-3">
            {saving ? '발송 중...' : '📢 공지 발송'}
          </button>
        </div>
      </div>

      {/* Announcement list */}
      {announcements.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          <div className="text-4xl mb-3">📢</div>
          <p>작성된 공지가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map(a => (
            <div
              key={a.id}
              className={`bg-white rounded-2xl p-4 border transition-all ${
                a.is_active ? 'border-blue-200 shadow-sm' : 'border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`badge ${a.type === 'modal' ? 'badge-blue' : 'badge-gray'}`}>
                      {a.type === 'modal' ? '팝업' : '배너'}
                    </span>
                    {a.is_active
                      ? <span className="badge badge-green">✓ 활성</span>
                      : <span className="badge badge-gray">비활성</span>
                    }
                    <span className="text-xs text-slate-400">{fmt(a.created_at)}</span>
                  </div>
                  <p className="font-semibold text-slate-800">{a.title}</p>
                  {a.content && (
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{a.content}</p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggle(a)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
                      a.is_active
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {a.is_active ? '숨김' : '표시'}
                  </button>
                  <button
                    onClick={() => remove(a)}
                    className="text-red-400 text-sm px-2 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
