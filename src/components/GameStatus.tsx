'use client';

import { useRouter } from 'next/navigation';

interface GameWaitingProps {
  gameName: string;
  gameEmoji?: string;
}

export function GameWaiting({ gameName, gameEmoji = '⏳' }: GameWaitingProps) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="card text-center max-w-sm w-full py-12 animate-slide-up">
        <div className="text-6xl mb-4 animate-bounce-slow">{gameEmoji}</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">{gameName}</h2>
        <p className="text-slate-500 mb-6">관리자가 게임을 시작할 때까지<br />잠시 기다려 주세요...</p>
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <button className="btn-secondary" onClick={() => router.push('/')}>홈으로</button>
      </div>
    </div>
  );
}

interface GameEndedProps {
  gameName: string;
  summary?: React.ReactNode;
}

export function GameEnded({ gameName, summary }: GameEndedProps) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-slide-up">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">게임 종료!</h2>
        <p className="text-slate-500 mb-4">{gameName}</p>
        {summary && <div className="mb-6">{summary}</div>}
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => router.push('/leaderboard')}>
            🏆 랭킹 보기
          </button>
          <button className="btn-primary flex-1" onClick={() => router.push('/')}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
