import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { instructorApi } from '../../api/instructor';
import { useCourseId } from '../../hooks/useCourseId';
import TagChip from '../common/TagChip';

interface RiskStudent {
  id: string;
  name: string;
  reasons: string[];
}

const PAGE_SIZE = 5;

export default function RiskAlertBanner() {
  const courseId = useCourseId();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data: students = [] } = useQuery({
    queryKey: ['instructor', 'risk-alerts', courseId],
    queryFn: async () => {
      const entries = await instructorApi.getCourseStudents(courseId!);
      return entries
        .filter((e) => Number(e.overallRiskScore) >= 50)
        .map((e) => {
          const reasons: string[] = [];
          if (Number(e.masteryScore) < 50) reasons.push('이해도 부족');
          if (Number(e.motivationScore) < 50) reasons.push('동기 저하');
          if (Number(e.overallRiskScore) >= 70) reasons.push('고위험');
          if (e.aiInsight) reasons.push(e.aiInsight.slice(0, 20));
          if (reasons.length === 0) reasons.push('주의 필요');
          return { id: String(e.studentId), name: e.studentName, reasons };
        });
    },
    enabled: !!courseId,
    staleTime: 30_000,
  });

  if (students.length === 0) return null;

  const totalPages = Math.ceil(students.length / PAGE_SIZE);
  const pagedStudents = students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold">
          {students.length}
          <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-40" />
        </span>
        <h3 className="text-sm font-semibold text-rose-800">
          즉시 개입이 필요한 학생
        </h3>
        {totalPages > 1 && (
          <span className="text-xs text-rose-400 ml-auto">
            {page + 1} / {totalPages}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {pagedStudents.map((s: RiskStudent) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-3 rounded-xl bg-white/80 border border-rose-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-700">
                {s.name.charAt(0)}
              </div>
              <div>
                <span className="text-sm font-medium text-slate-800">{s.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {s.reasons.map((r) => (
                    <TagChip key={r} label={r} color="rose" size="sm" />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => navigate('/instructor/consultations', { state: { preselectedStudentId: s.id, preselectedStudentName: s.name } })}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
              >
                상담 예약
              </button>
              <button
                onClick={() => navigate('/instructor/consultations', { state: { preselectedStudentId: s.id, preselectedStudentName: s.name, immediateContact: true } })}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
              >
                즉시 연락
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-rose-200">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-6 h-6 text-xs font-medium rounded-lg transition-colors ${
                i === page
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-600 hover:bg-white border border-rose-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
