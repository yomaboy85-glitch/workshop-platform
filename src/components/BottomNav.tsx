'use client';

import { useRouter } from 'next/navigation';

type NavItem = 'home' | 'leaderboard' | 'team' | 'profile';

interface Props {
  active: NavItem;
}

export default function BottomNav({ active }: Props) {
  const router = useRouter();

  const items: { key: NavItem; label: string; icon: string; path: string }[] = [
    { key: 'home', label: '홈', icon: '🏠', path: '/' },
    { key: 'leaderboard', label: '랭킹', icon: '🏆', path: '/leaderboard' },
    { key: 'team', label: '팀', icon: '👥', path: '/team' },
    { key: 'profile', label: '내 정보', icon: '👤', path: '/profile' },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => router.push(item.path)}
          className={`nav-item ${active === item.key ? 'active' : ''}`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-xs font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
