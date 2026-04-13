import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { recommendationsApi } from '../../api/recommendations';
import { useAuthStore } from '../../store/authStore';
import { useCourseId } from '../../hooks/useCourseId';
import type { Recommendation } from '../../types';
import { getRecommendationAction } from '../../utils/recommendations';

const TYPE_STYLES: Record<string, { accent: string; icon: string }> = {
  review: { accent: 'from-indigo-500 to-violet-500', icon: '📖' },
  practice: { accent: 'from-emerald-500 to-teal-500', icon: '💻' },
  consultation: { accent: 'from-amber-500 to-orange-500', icon: '💬' },
};

const NextStepPrescriptionCard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const studentId = user?.id?.toString() ?? '';
  const courseId = useCourseId();
  const { data: recs } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', studentId, courseId],
    queryFn: () => recommendationsApi.getRecommendations(studentId, courseId),
    enabled: !!studentId,
  });

  const list = recs ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        다음 단계 처방
      </h2>

      {list.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">추천이 아직 없습니다</p>
          <p className="text-xs text-slate-400 mt-1">학습 데이터가 쌓이면 AI가 맞춤 추천을 생성합니다</p>
        </div>
      ) : (
      <div className="space-y-3">
        {list.map((rec, i) => {
          const style = TYPE_STYLES[rec.recommendationType] ?? TYPE_STYLES.review;
          const isFirst = i === 0;
          const action = getRecommendationAction(rec.recommendationType);
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`relative rounded-xl border p-4 transition-all hover:shadow-sm ${
                isFirst
                  ? 'border-indigo-200 bg-indigo-50/40'
                  : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              {/* Gradient accent bar */}
              {isFirst && (
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b ${style.accent}`}
                />
              )}

              <div className="flex items-start gap-3">
                <span className="text-lg">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {rec.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {rec.reasonSummary}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                    예상: {rec.expectedOutcome}
                  </p>
                </div>
                <button
                  onClick={() => navigate(action.path)}
                  className="shrink-0 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  {action.label}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}
    </motion.div>
  );
};

export default NextStepPrescriptionCard;
