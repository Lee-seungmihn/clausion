import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '../../api/courses';

export default function CourseCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [classTime, setClassTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('30');

  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const selectedDays = schedule ? schedule.split(',').filter(Boolean) : [];
  const toggleDay = (day: string) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setSchedule(next.join(','));
  };

  const createMut = useMutation({
    mutationFn: () =>
      coursesApi.createCourse({
        title,
        description,
        schedule: schedule || undefined,
        classTime: classTime || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        maxCapacity: maxCapacity ? Number(maxCapacity) : undefined,
      }),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate(`/instructor/curriculum?courseId=${course.id}`);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-base font-bold text-slate-800">새 과정 만들기</h1>
          <p className="text-xs text-slate-500">과정을 생성한 뒤 커리큘럼을 등록하세요</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-2">과정명</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 풀스택 웹개발 부트캠프"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-2">과정 설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="과정에 대한 간략한 설명을 입력하세요"
            rows={4}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-3">수강 기간</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <span className="text-slate-400 mt-5">~</span>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">종료일</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
          </div>
          {startDate && endDate && (
            <p className="text-xs text-slate-400 mt-2">
              총 {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}일간 진행
            </p>
          )}
        </div>

        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-3">수강일</label>
          <div className="flex items-center gap-2">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                  selectedDays.includes(day)
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          {selectedDays.length > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              매주 {selectedDays.join(', ')}요일
            </p>
          )}
        </div>

        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-2">수강 시간</label>
          <input
            type="text"
            value={classTime}
            onChange={(e) => setClassTime(e.target.value)}
            placeholder="예: 10:00 ~ 12:00"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-slate-800 mb-2">정원</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={500}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="w-32 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            <span className="text-sm text-slate-500">명</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">정원이 차면 더 이상 수강 신청을 받지 않습니다</p>
        </div>

        {createMut.isError && (
          <p className="text-sm text-rose-500 text-center">
            {createMut.error instanceof Error ? createMut.error.message : '과정 생성에 실패했습니다.'}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={!title.trim() || createMut.isPending}
            className="flex-1 py-3 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {createMut.isPending ? '생성 중...' : '과정 생성'}
          </button>
        </div>
      </main>
    </div>
  );
}
