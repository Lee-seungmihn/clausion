import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function OperatorLogin() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.role !== 'OPERATOR') {
        setError('운영자 계정이 아닙니다. 교강사/수강생은 일반 로그인 페이지를 이용하세요.');
        // Log the non-operator user back out
        useAuthStore.getState().logout();
        return;
      }
      navigate('/operator');
    } catch {
      setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left gradient panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b, #0f2744)',
        }}
      >
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-2xl font-bold">CP</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">ClassPulse Twin</h2>
          <p className="text-slate-400 text-sm font-semibold mb-2 uppercase tracking-widest">교육 운영 시스템</p>
          <p className="text-white/60 leading-relaxed">
            운영자 전용 포털입니다. 과정 관리, 강사 분석, 개입 센터 등 전체 시스템을 제어합니다.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold mb-4">
              운영자 전용
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">운영자 로그인</h1>
            <p className="text-sm text-slate-500 mt-1">교육 운영 시스템에 로그인하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@classpulse.kr"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40 focus:border-slate-400 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40 focus:border-slate-400 transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? '로그인 중...' : '운영자 로그인'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            교강사/수강생 로그인은{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
              여기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
