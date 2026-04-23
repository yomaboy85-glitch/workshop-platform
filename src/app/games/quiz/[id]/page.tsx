'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { GameWaiting, GameEnded } from '@/components/GameStatus';
import { useRealtime } from '@/hooks/useRealtime';
import ScorePopup from '@/components/ScorePopup';

interface Question {
  text: string;
  options: string[];
  answer: number;
  score: number;
}

interface QuizConfig {
  questions: Question[];
  timeLimit: number;
  scorePerQuestion: number;
}

interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'playing' | 'ended';
  config: QuizConfig;
}

export default function QuizGamePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const { showToast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(30);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scorePopup, setScorePopup] = useState<number | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profile) { router.push('/login'); return; }
    fetchGame();
    return () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); };
  }, [profile]);

  const fetchGame = async () => {
    const { data, error } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (error || !data) { showToast('게임을 불러올 수 없습니다.', 'error'); setLoading(false); return; }
    const g = data as unknown as Game;
    setGame(g);
    setTimeLeft(g.config.timeLimit || 30);
    setLoading(false);

    // fetch answered after game is loaded
    const { data: myAns } = await supabase
      .from('quiz_answers')
      .select('question_index, is_correct')
      .eq('game_id', gameId)
      .eq('user_id', profile!.id);

    if (myAns && myAns.length > 0) {
      const set = new Set(myAns.map((a: { question_index: number }) => a.question_index));
      setAnswered(set);
      setCorrectCount(myAns.filter((a: { is_correct: boolean }) => a.is_correct).length);
      const total = (g.config.questions || []).length;
      const firstUnanswered = Array.from({ length: total }, (_, i) => i).find(i => !set.has(i));
      if (firstUnanswered === undefined) setShowResult(true);
      else setCurrentQ(firstUnanswered);
    }
  };

  useRealtime(`quiz-game-${gameId}`, [{
    table: 'games',
    filter: `id=eq.${gameId}`,
    onUpdate: (row) => setGame(prev => prev ? { ...prev, ...(row as Partial<Game>) } : null),
  }], !!gameId);

  useEffect(() => {
    if (!game || game.status !== 'playing' || answered.has(currentQ) || showResult) return;
    if (timeLeft <= 0) { handleTimeout(); return; }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, game?.status, currentQ, answered, showResult]);

  const handleTimeout = useCallback(async () => {
    if (!game || !profile || answered.has(currentQ)) return;
    await supabase.from('quiz_answers').upsert({
      game_id: gameId,
      user_id: profile.id,
      question_index: currentQ,
      answer: 'timeout',
      is_correct: false,
    }, { onConflict: 'game_id,user_id,question_index' });
    setAnswered(prev => new Set([...prev, currentQ]));
    setSelected(-1);
    scheduleAdvance(game);
  }, [game, profile, currentQ, answered, gameId]);

  const scheduleAdvance = (g: Game) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      const total = g.config.questions.length;
      setCurrentQ(prev => {
        if (prev + 1 < total) {
          setSelected(null);
          setTimeLeft(g.config.timeLimit || 30);
          return prev + 1;
        } else {
          setShowResult(true);
          return prev;
        }
      });
    }, 2000);
  };

  const handleAnswer = async (optionIdx: number) => {
    if (!game || !profile || answered.has(currentQ) || selected !== null) return;
    setSelected(optionIdx);

    const q = game.config.questions[currentQ];
    const isCorrect = optionIdx === q.answer;
    const score = isCorrect ? (q.score || game.config.scorePerQuestion || 100) : 0;

    await supabase.from('quiz_answers').upsert({
      game_id: gameId,
      user_id: profile.id,
      question_index: currentQ,
      answer: String(optionIdx),
      is_correct: isCorrect,
    }, { onConflict: 'game_id,user_id,question_index' });

    if (isCorrect && score > 0) {
      const { data: tm } = await supabase
        .from('team_members').select('team_id').eq('user_id', profile.id).maybeSingle();
      await supabase.from('scores').insert({
        user_id: profile.id,
        team_id: tm?.team_id || null,
        game_id: gameId,
        points: score,
        reason: `퀴즈 ${currentQ + 1}번 정답`,
      });
      if (tm?.team_id) {
        const { data: teamRow } = await supabase
          .from('teams').select('total_score').eq('id', tm.team_id).single();
        if (teamRow) {
          await supabase.from('teams')
            .update({ total_score: teamRow.total_score + score })
            .eq('id', tm.team_id);
        }
      }
      setCorrectCount(c => c + 1);
      setScorePopup(score);
    }

    setAnswered(prev => new Set([...prev, currentQ]));
    scheduleAdvance(game);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  if (!game) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card text-center">
        <p className="text-slate-500 mb-3">게임을 찾을 수 없습니다</p>
        <button className="btn-primary" onClick={() => router.push('/')}>홈으로</button>
      </div>
    </div>
  );
  if (game.status === 'waiting') return <GameWaiting gameName={game.name} gameEmoji="🧠" />;

  const total = game.config.questions?.length || 0;
  if (showResult || game.status === 'ended') {
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <GameEnded
        gameName={game.name}
        summary={
          <div className="bg-blue-50 rounded-2xl p-5">
            <p className="text-4xl font-bold text-blue-600">{correctCount} / {total}</p>
            <p className="text-slate-500 mt-1">정답률 {pct}%</p>
            <p className="text-slate-400 text-sm mt-2">
              {pct >= 80 ? '🏆 훌륭합니다!' : pct >= 50 ? '👍 잘 했어요!' : '💪 다음엔 더 잘할 수 있어요!'}
            </p>
          </div>
        }
      />
    );
  }

  const questions = game.config.questions || [];
  if (questions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card text-center">
        <p className="text-slate-500">문제가 없습니다</p>
        <button className="btn-secondary mt-3" onClick={() => router.push('/')}>홈으로</button>
      </div>
    </div>
  );

  const q = questions[currentQ];
  const timerPct = (timeLeft / (game.config.timeLimit || 30)) * 100;
  const isAnswered = answered.has(currentQ);

  return (
    <div className="min-h-screen bg-slate-50">
      {scorePopup !== null && (
        <ScorePopup score={scorePopup} onDone={() => setScorePopup(null)} />
      )}
      <div className="bg-blue-600 text-white px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push('/')} className="text-blue-200 text-sm">← 뒤로</button>
          <span className="font-bold">{game.name}</span>
          <span className="text-blue-200 text-sm">{currentQ + 1} / {total}</span>
        </div>
        <div className="h-1.5 bg-blue-500 rounded-full">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${(currentQ / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                timerPct > 50 ? 'bg-green-500' : timerPct > 25 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <span className={`font-bold text-lg w-8 text-right tabular-nums ${timeLeft <= 10 ? 'text-red-500' : 'text-slate-700'}`}>
            {timeLeft}
          </span>
        </div>

        <div className="card">
          <p className="text-xs font-bold text-blue-500 mb-2 uppercase tracking-wide">
            문제 {currentQ + 1}
            {q.score && <span className="ml-2 text-slate-400 normal-case font-normal">({q.score}점)</span>}
          </p>
          <p className="text-lg font-bold text-slate-800 leading-relaxed">{q.text}</p>
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt, idx) => {
            let cls = 'bg-white border-2 border-slate-200 text-slate-800 hover:border-blue-300 active:scale-[0.98]';
            if (isAnswered) {
              if (idx === q.answer) cls = 'bg-green-50 border-2 border-green-500 text-green-700';
              else if (idx === selected) cls = 'bg-red-50 border-2 border-red-400 text-red-600 opacity-80';
              else cls = 'bg-white border-2 border-slate-100 text-slate-400';
            }
            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={isAnswered}
                className={`w-full text-left p-4 rounded-2xl font-medium transition-all duration-150 ${cls} ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className="mr-3 text-sm opacity-50 font-bold">{['①','②','③','④','⑤'][idx]}</span>
                {opt}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`card text-center py-4 border-2 animate-fade-in ${selected === q.answer ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-xl font-bold ${selected === q.answer ? 'text-green-600' : 'text-red-500'}`}>
              {selected === q.answer ? '🎉 정답!' : selected === -1 ? '⏰ 시간 초과!' : '❌ 오답!'}
            </p>
            {selected !== q.answer && selected !== -1 && (
              <p className="text-slate-600 text-sm mt-1">정답: <strong>{q.options[q.answer]}</strong></p>
            )}
            <p className="text-slate-400 text-xs mt-2">
              {currentQ + 1 < total ? '잠시 후 다음 문제...' : '퀴즈 완료!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
