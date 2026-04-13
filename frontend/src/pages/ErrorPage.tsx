import { useNavigate } from 'react-router-dom';
import { Component, type ReactNode, type ErrorInfo } from 'react';

function ErrorDisplay({ status, title, message, stack }: { status?: number; title: string; message: string; stack?: string }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-rose-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        {/* Status code */}
        {status && (
          <p className="text-6xl font-black text-slate-200 mb-2">{status}</p>
        )}

        {/* Title */}
        <h1 className="text-xl font-bold text-slate-800 mb-2">{title}</h1>

        {/* Message */}
        <p className="text-sm text-slate-500 leading-relaxed mb-6">{message}</p>

        {/* Error details (collapsible) */}
        {stack && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
              상세 에러 정보 보기
            </summary>
            <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-[11px] text-slate-300 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
              {stack}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 text-sm font-medium rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            뒤로 가기
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            홈으로
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 text-sm font-medium rounded-xl border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}

/** 404 Not Found page - used as catch-all route element */
export default function ErrorPage() {
  return (
    <ErrorDisplay
      status={404}
      title="페이지를 찾을 수 없습니다"
      message="요청한 페이지가 존재하지 않거나 접근할 수 없습니다."
    />
  );
}

/** Class-based ErrorBoundary - catches render-time errors */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-rose-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">화면을 표시할 수 없습니다</h1>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">{this.state.error.message}</p>
            <details className="mb-6 text-left">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
                상세 에러 정보 보기
              </summary>
              <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-[11px] text-slate-300 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
                {this.state.error.stack}
              </pre>
            </details>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="px-5 py-2.5 text-sm font-medium rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                뒤로 가기
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="px-5 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                홈으로
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 text-sm font-medium rounded-xl border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
