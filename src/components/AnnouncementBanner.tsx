'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'banner' | 'modal';
  is_active: boolean;
}

export default function AnnouncementBanner() {
  const [banners, setBanners] = useState<Announcement[]>([]);
  const [modal, setModal] = useState<Announcement | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      setBanners(data.filter(a => a.type === 'banner'));
      const activeModal = data.find(a => a.type === 'modal' && !dismissedIds.has(a.id));
      setModal(activeModal || null);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const channel = supabase
      .channel('announcements-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const dismissModal = () => {
    if (modal) {
      setDismissedIds(prev => new Set([...prev, modal.id]));
      setModal(null);
    }
  };

  return (
    <>
      {/* Banner announcements */}
      {banners.length > 0 && (
        <div className="bg-blue-600 text-white">
          {banners.map(b => (
            <div key={b.id} className="px-4 py-2.5 text-center text-sm">
              <span className="font-semibold">{b.title}</span>
              {b.content && <span className="ml-2 opacity-90">{b.content}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Modal announcement */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">📢</div>
              <h2 className="text-xl font-bold text-slate-800">{modal.title}</h2>
            </div>
            <p className="text-slate-600 text-center mb-6 leading-relaxed">{modal.content}</p>
            <button onClick={dismissModal} className="btn-primary w-full">
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
