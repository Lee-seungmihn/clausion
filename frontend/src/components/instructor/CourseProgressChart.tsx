import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCourseId } from '../../hooks/useCourseId';
import { coursesApi } from '../../api/courses';
import { useEffect, useRef } from 'react';

interface WeekProgress {
  week: number;
  label: string;
  progress: number;
  status: 'completed' | 'current' | 'upcoming';
}

const barColor = (status: string) => {
  switch (status) {
    case 'completed': return '#6366f1';
    case 'current': return '#818cf8';
    case 'upcoming': return '#e2e8f0';
    default: return '#e2e8f0';
  }
};

export default function CourseProgressChart() {
  const courseId = useCourseId();
  const queryClient = useQueryClient();
  const recoveryAttempted = useRef<string | null>(null);

  const { data: weeks = [] } = useQuery<WeekProgress[]>({
    queryKey: ['instructor', 'course-progress', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const course = await coursesApi.getCourse(courseId);
      const courseWeeks = course.weeks;
      if (!courseWeeks || courseWeeks.length === 0) return [];

      const now = new Date();
      const courseStart = course.startDate ? new Date(course.startDate) : new Date(course.createdAt);
      const weeksSinceStart = Math.floor((now.getTime() - courseStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

      return courseWeeks
        .sort((a, b) => a.weekNo - b.weekNo)
        .map((w) => {
          let status: WeekProgress['status'] = 'upcoming';
          let progress = 0;
          if (w.weekNo <= weeksSinceStart) {
            status = 'completed';
            progress = Math.max(60, 100 - (weeksSinceStart - w.weekNo) * 3);
          } else if (w.weekNo === weeksSinceStart + 1) {
            status = 'current';
            progress = Math.round(((now.getDay() || 7) / 7) * 100);
          }
          return { week: w.weekNo, label: `${w.weekNo}주`, progress, status };
        });
    },
    enabled: !!courseId,
    staleTime: 60_000,
  });

  // weeks가 비어있으면 자동으로 recover-weeks 시도
  useEffect(() => {
    if (!courseId || weeks.length > 0) return;
    if (recoveryAttempted.current === courseId) return;
    recoveryAttempted.current = courseId;
    coursesApi.recoverWeeks(courseId).then((res) => {
      if (res.count > 0) {
        queryClient.invalidateQueries({ queryKey: ['instructor', 'course-progress', courseId] });
      }
    }).catch(() => {});
  }, [courseId, weeks.length, queryClient]);

  if (weeks.length === 0) {
    return (
      <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">주차별 학습 진행률</h3>
        <p className="text-sm text-slate-400 text-center py-8">
          커리큘럼이 등록되면 진행률이 표시됩니다
        </p>
      </div>
    );
  }

  const viewBoxW = 340;
  const viewBoxH = 180;
  const paddingLeft = 30;
  const paddingBottom = 24;
  const chartW = viewBoxW - paddingLeft - 10;
  const chartH = viewBoxH - paddingBottom - 10;
  const barWidth = chartW / weeks.length * 0.6;
  const barGap = chartW / weeks.length;

  return (
    <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">주차별 학습 진행률</h3>

      <svg viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} className="w-full">
        {[25, 50, 75, 100].map((pct) => {
          const y = 10 + chartH - (pct / 100) * chartH;
          return (
            <g key={pct}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={viewBoxW - 10}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={0.5}
                strokeDasharray="2,2"
              />
              <text x={paddingLeft - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">
                {pct}%
              </text>
            </g>
          );
        })}

        {weeks.map((w, i) => {
          const x = paddingLeft + i * barGap + (barGap - barWidth) / 2;
          const height = w.status === 'upcoming' ? (chartH * 0.08) : (w.progress / 100) * chartH;
          const y = 10 + chartH - height;

          return (
            <g key={w.week}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={3}
                fill={barColor(w.status)}
                opacity={w.status === 'current' ? 1 : 0.85}
              />
              {w.status === 'current' && (
                <rect
                  x={x - 1}
                  y={y - 1}
                  width={barWidth + 2}
                  height={height + 2}
                  rx={4}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  strokeDasharray="3,2"
                />
              )}
              {w.status !== 'upcoming' && (
                <text
                  x={x + barWidth / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#6366f1"
                  fontWeight={600}
                >
                  {w.progress}%
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={viewBoxH - 6}
                textAnchor="middle"
                fontSize={7}
                fill={w.status === 'current' ? '#6366f1' : '#94a3b8'}
                fontWeight={w.status === 'current' ? 700 : 400}
              >
                {w.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> 완료
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 border border-indigo-500 border-dashed" /> 진행 중
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-200" /> 예정
        </span>
      </div>
    </div>
  );
}
