'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError('');

    const isAdmin = adminSecret === (process.env.NEXT_PUBLIC_ADMIN_SECRET || 'workshop2024');

    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });

    if (authErr || !authData.user) {
      setError(authErr?.message || '회원가입에 실패했습니다.');
      setLoading(false);
      return;
    }

    const { error: profileErr } = await supabase.from('users').insert({
      auth_id: authData.user.id,
      name: name.trim(),
      role: isAdmin ? 'admin' : 'user',
      is_online: true,
    });

    if (profileErr) {
      setError('프로필 생성에 실패했습니다: ' + profileErr.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(isAdmin ? '/admin' : '/');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });

      if (loginErr || !data.user) {
        setError('로그인 실패: ' + (loginErr?.message || '이메일과 비밀번호를 확인해주세요.'));
        setLoading(false);
        return;
      }

      // profile 조회
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', data.user.id)
        .single();

      setLoading(false);

      if (profile?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (e) {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">
            🎮
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">워크샵 플랫폼</h1>
          <p className="text-blue-200 text-sm">실시간 게임 & 팀 활동 관리</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); setLoading(false); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === 'login' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); setLoading(false); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === 'register' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
              }`}
            >
              회원가입
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">이름</label>
                <input
                  className="input"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">이메일</label>
              <input
                className="input"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">비밀번호</label>
              <input
                className="input"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
              />
            </div>
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  관리자 코드 <span className="font-normal text-slate-400">(선택 - 관리자인 경우만)</span>
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="관리자 코드 (없으면 비워두세요)"
                  value={adminSecret}
                  onChange={e => setAdminSecret(e.target.value)}
                />
              </div>
            )}
          </div>

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            className="btn-primary w-full mt-5 py-3 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" /> 처리 중...
              </span>
            ) : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </div>

        <p className="text-center text-blue-200 text-xs mt-4">
          워크샵 참가 코드가 있다면 관리자에게 문의하세요
        </p>
      </div>
    </div>
  );
}
