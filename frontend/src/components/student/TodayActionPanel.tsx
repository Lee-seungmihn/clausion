import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { reviewsApi } from '../../api/reviews';
import { useCourseId } from '../../hooks/useCourseId';
import type { ReviewTask } from '../../types';

const REASON_BADGE: Record<string, { label: string; color: string }> = {
  forgetting: { label: '망각위험', color: 'bg-rose-100 text-rose-700' },
  weakness: { label: '약점보강', color: 'bg-amber-100 text-amber-700' },
  consultation: { label: '상담후속', color: 'bg-indigo-100 text-indigo-700' },
};

function getReasonBadge(reason: string) {
  if (reason.includes('망각') || reason.includes('forgetting'))
    return REASON_BADGE.forgetting;
  if (reason.includes('약점') || reason.includes('weakness'))
    return REASON_BADGE.weakness;
  if (reason.includes('상담') || reason.includes('consultation'))
    return REASON_BADGE.consultation;
  return { label: reason, color: 'bg-slate-100 text-slate-600' };
}

const TodayActionPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const courseId = useCourseId();

  const { data: tasks, isLoading } = useQuery<ReviewTask[]>({
    queryKey: ['reviewsToday', courseId],
    queryFn: () => reviewsApi.getTodayReviews(courseId),
  });

  const completeMutation = useMutation({
    mutationFn: (reviewId: string) => reviewsApi.completeReview(reviewId),
    onMutate: async (reviewId) => {
      await queryClient.cancelQueries({ queryKey: ['reviewsToday', courseId] });
      const previous = queryClient.getQueryData<ReviewTask[]>(['reviewsToday']);
      queryClient.setQueryData<ReviewTask[]>(['reviewsToday'], (old) =>
        old?.map((t) =>
          String(t.id) === String(reviewId)
            ? { ...t, status: 'COMPLETED' as const, completedAt: new Date().toISOString() }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['reviewsToday'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewsToday', courseId] });
    },
  });

  const activeTasks = (tasks ?? []).filter(
    (t) => t.status !== 'COMPLETED',
  );
  const completedCount = (tasks ?? []).filter(
    (t) => t.status === 'COMPLETED',
  ).length;
  const totalCount = (tasks ?? []).length;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">오늘의 할 일</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {completedCount}/{totalCount} 완료
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{
                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-slate-50 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {activeTasks.map((task, index) => {
              const badge = getReasonBadge(task.reasonSummary);
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-white hover:shadow-sm transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        #{String(task.skillId).slice(-3)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {task.reasonSummary}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center text-xs text-slate-400">
                        <svg
                          className="w-3.5 h-3.5 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        약 15분
                      </span>
                      {task.status === 'IN_PROGRESS' && (
                        <span className="text-xs text-indigo-600 font-medium">
                          진행 중
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => completeMutation.mutate(task.id)}
                    disabled={completeMutation.isPending}
                    className="shrink-0 mt-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200 transition-colors disabled:opacity-50"
                  >
                    완료
                  </button>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {activeTasks.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-sm font-medium text-slate-600">
            오늘의 할 일을 모두 완료했어요!
          </p>
          <p className="text-xs text-slate-400 mt-1">내일도 함께 화이팅!</p>
        </div>
      )}
    </div>
  );
};

export default TodayActionPanel;
