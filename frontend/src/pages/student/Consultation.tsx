import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ConsultationActionCard from '../../components/student/ConsultationActionCard';
import { consultationsApi } from '../../api/consultations';
import { useCourseId } from '../../hooks/useCourseId';
import type { Consultation, ActionPlan } from '../../types';

const PLAN_STATUS_STYLES: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  COMPLETED: {
    icon: '✓',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  IN_PROGRESS: {
    icon: '◐',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  PENDING: {
    icon: '○',
    color: 'text-slate-400',
    bg: 'bg-slate-50',
  },
};

function parseActionPlans(con: Consultation): ActionPlan[] {
  // actionPlanJson can be a string or already-parsed array from the backend
  const raw = con.actionPlanJson;
  if (Array.isArray(raw)) return raw as unknown as ActionPlan[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

const ConsultationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const courseId = useCourseId();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestReason, setRequestReason] = useState('');

  const { data: consultations, isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations', 'student', courseId],
    queryFn: () => consultationsApi.getConsultations('student', courseId),
  });

  const requestMutation = useMutation({
    mutationFn: () => consultationsApi.requestConsultation({
      courseId: Number(courseId),
      message: requestReason || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setShowRequestForm(false);
      setRequestReason('');
    },
  });

  const pastConsultations = (consultations ?? []).filter((c) => c.status === 'COMPLETED');
  const requestedConsultations = (consultations ?? []).filter((c) => c.status === 'REQUESTED');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">상담 관리</h1>
            <p className="text-xs text-slate-500">
              강사 상담 일정과 실행 계획을 확인하세요
            </p>
          </div>
          {courseId && (
            <button
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {showRequestForm ? '취소' : '상담 요청'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Request form */}
        {showRequestForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-indigo-50 border border-indigo-200 p-5"
          >
            <h3 className="text-sm font-bold text-indigo-800 mb-2">교강사에게 상담 요청</h3>
            <textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="상담을 요청하는 이유를 입력하세요 (선택사항)"
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-indigo-200 bg-white text-sm resize-none mb-3"
            />
            <button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {requestMutation.isPending ? '요청 중...' : '상담 요청 보내기'}
            </button>
          </motion.div>
        )}

        {/* Requested consultations */}
        {requestedConsultations.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
            <h3 className="text-sm font-bold text-amber-800 mb-2">요청 대기 중인 상담</h3>
            {requestedConsultations.map((c) => (
              <p key={c.id} className="text-xs text-amber-700">
                {c.courseTitle ?? '과정'} — 교강사 확인 대기 중
              </p>
            ))}
          </div>
        )}

        {/* Upcoming consultations card */}
        <ConsultationActionCard />

        {/* Past consultations detail */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-5">
            지난 상담 기록
          </h2>

          {isLoading && (
            <p className="text-sm text-slate-400 text-center py-6">불러오는 중...</p>
          )}

          {!isLoading && pastConsultations.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">지난 상담 기록이 없습니다.</p>
          )}

          <div className="space-y-6">
            {pastConsultations.map((con, i) => {
              const actionPlans = parseActionPlans(con);
              const completedPlans = actionPlans.filter(
                (p) => p.status === 'COMPLETED',
              ).length;
              const totalPlans = actionPlans.length;
              const completionRate =
                totalPlans > 0
                  ? Math.round((completedPlans / totalPlans) * 100)
                  : 0;

              return (
                <motion.div
                  key={con.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="border border-slate-100 rounded-xl p-5"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                        완료
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(con.scheduledAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      실행률 {completionRate}%
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">
                    {con.summaryText}
                  </p>

                  {/* Action Plan Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-600">
                        실행 계획 ({completedPlans}/{totalPlans})
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <div className="space-y-2">
                      {actionPlans.map((plan, j) => {
                        const style =
                          PLAN_STATUS_STYLES[plan.status] ??
                          PLAN_STATUS_STYLES.PENDING;
                        return (
                          <div
                            key={j}
                            className={`flex items-center gap-3 rounded-lg p-2.5 ${style.bg}`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${style.color} bg-white`}
                            >
                              {style.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-medium ${
                                  plan.status === 'COMPLETED'
                                    ? 'text-slate-400 line-through'
                                    : 'text-slate-700'
                                }`}
                              >
                                {plan.title}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                기한:{' '}
                                {new Date(plan.dueDate).toLocaleDateString(
                                  'ko-KR',
                                  { month: 'short', day: 'numeric' },
                                )}{' '}
                                | 우선순위: {plan.priority}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConsultationPage;
