'use client';

import { useEffect, useState } from 'react';

interface Props {
  score: number;
  onDone?: () => void;
}

export default function ScorePopup({ score, onDone }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      <div
        className="score-popup-anim bg-green-500 text-white font-bold text-3xl px-8 py-4 rounded-2xl shadow-2xl"
      >
        +{score.toLocaleString()}점 🎉
      </div>
    </div>
  );
}
