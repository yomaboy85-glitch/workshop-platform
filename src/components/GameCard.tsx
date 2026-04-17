'use client';

interface Game {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
}

interface Props {
  game: Game;
  typeLabel: string;
  onClick: () => void;
}

const statusLabel: Record<string, { text: string; className: string }> = {
  waiting: { text: '대기 중', className: 'status-waiting' },
  playing: { text: '진행 중 🔴', className: 'status-playing' },
  ended: { text: '종료', className: 'status-ended' },
};

const typeColor: Record<string, string> = {
  quiz: 'bg-blue-500',
  mission: 'bg-emerald-500',
  timer: 'bg-sky-500',
  voting: 'bg-violet-500',
  treasure: 'bg-amber-500',
};

export default function GameCard({ game, typeLabel, onClick }: Props) {
  const status = statusLabel[game.status] || { text: game.status, className: 'badge-gray' };
  const color = typeColor[game.type] || 'bg-slate-500';

  return (
    <div
      onClick={game.status === 'ended' ? undefined : onClick}
      className={`card flex items-center gap-4 transition-all duration-150 ${
        game.status === 'ended' ? 'opacity-50' : 'hover:shadow-md active:scale-98 cursor-pointer'
      }`}
    >
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
        {game.type === 'quiz' ? '🧠' :
         game.type === 'mission' ? '🎯' :
         game.type === 'timer' ? '⏱️' :
         game.type === 'voting' ? '🗳️' :
         game.type === 'treasure' ? '🗺️' : '🎮'}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-800">{game.name}</h3>
        <p className="text-slate-500 text-sm">{typeLabel}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={status.className}>{status.text}</span>
        {game.status === 'playing' && (
          <span className="text-xs text-blue-500 font-medium">참여하기 →</span>
        )}
      </div>
    </div>
  );
}
