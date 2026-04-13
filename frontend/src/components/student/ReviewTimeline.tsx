import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { reviewsApi } from '../../api/reviews';
import { useCourseId } from '../../hooks/useCourseId';
import type { WeekDaySummary } from '../../api/reviews';

type DayStatus = 'completed' | 'partial' | 'missed' | 'today' | 'future';

const STATUS_STYLES: Record<
  DayStatus,
  { bg: string; ring: string; text: string; label: string }
> = {
  completed: {
    bg: 'bg-emerald-500',
    ring: '',
    text: 'text-white',
    label: '',
  },
  partial: {
    bg: 'bg-amber-400',
    ring: '',
    text: 'text-white',
    label: '',
  },
  missed: {
    bg: 'bg-rose-400',
    ring: '',
    text: 'text-white',
    label: '',
  },
  today: {
    bg: 'bg-indigo-600',
    ring: 'ring-4 ring-indigo-200',
    text: 'text-white',
    label: '',
  },
  future: {
    bg: 'bg-slate-200',
    ring: '',
    text: 'text-slate-400',
    label: '-',
  },
};

function getStatusLabel(day: WeekDaySummary): string {
  if (day.status === 'future') return '-';
  if (day.status === 'today') return '!';
  if (day.total === 0) return '-';
  return `${day.completed}/${day.total}`;
}

const PLACEHOLDER: WeekDaySummary[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - 6 + i);
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return {
    date: d.toISOString().split('T')[0],
    dayLabel: labels[d.getDay()],
    total: 0,
    completed: 0,
    status: (i === 6 ? 'today' : 'future') as DayStatus,
  };
});

const ReviewTimeline: React.FC = () => {
  const courseId = useCourseId();
  const { data: week = PLACEHOLDER } = useQuery<WeekDaySummary[]>({
    queryKey: ['reviewWeekSummary', courseId],
    queryFn: () => reviewsApi.getWeekSummary(courseId),
  });

  const totalCompleted = week.reduce((s, d) => s + d.completed, 0);
  const totalTasks = week.reduce((s, d) => s + d.total, 0);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-slate-900">주간 복습 현황</h2>
        {totalTasks > 0 && (
          <span className="text-xs text-slate-500">
            {totalCompleted}/{totalTasks} 완료
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-5">최근 7일간 복습 기록</p>

      <div className="flex items-center justify-between px-2">
        {week.map((day, i) => {
          const style = STATUS_STYLES[day.status];
          return (
            <React.Fragment key={day.date}>
              {i > 0 && (
                <div className="flex-1 h-0.5 bg-slate-200 -mx-0.5" />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${style.bg} ${style.ring} ${style.text} text-[10px] font-bold`}
                  title={`${day.date}: ${day.completed}/${day.total} 완료`}
                >
                  {getStatusLabel(day)}
                </motion.div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {day.dayLabel}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-5 justify-center">
        {[
          { color: 'bg-emerald-500', label: '완료' },
          { color: 'bg-amber-400', label: '부분' },
          { color: 'bg-rose-400', label: '미완' },
          { color: 'bg-indigo-600', label: '오늘' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-[10px] text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewTimeline;
