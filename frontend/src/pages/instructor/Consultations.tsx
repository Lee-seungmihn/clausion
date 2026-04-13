import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { consultationsApi } from '../../api/consultations';
import { instructorApi } from '../../api/instructor';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useCourseId } from '../../hooks/useCourseId';
import type { Consultation } from '../../types';
import ConsultationLayout from '../../components/consultation/ConsultationLayout';
import PreBriefingPanel from '../../components/consultation/PreBriefingPanel';
import VideoPanel from '../../components/consultation/VideoPanel';
import LiveNotes from '../../components/consultation/LiveNotes';
import PostSummaryPanel from '../../components/consultation/PostSummaryPanel';
import TagChip from '../../components/common/TagChip';
import Modal from '../../components/common/Modal';

type View = 'list' | 'active';

const statusLabel: Record<string, { text: string; color: 'emerald' | 'amber' | 'slate' | 'rose' | 'indigo' }> = {
  REQUESTED: { text: '요청', color: 'rose' },
  SCHEDULED: { text: '예정', color: 'amber' },
  IN_PROGRESS: { text: '진행 중', color: 'emerald' },
  COMPLETED: { text: '완료', color: 'slate' },
};

export default function Consultations() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const courseId = useCourseId();

  const [view, setView] = useState<View>('list');
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);

  // 상담 예약 모달
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleStudentId, setScheduleStudentId] = useState('');
  const [scheduleStudentName, setScheduleStudentName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleRequestId, setScheduleRequestId] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);

  // 브리핑 모달
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [briefingConsultationId, setBriefingConsultationId] = useState<string | null>(null);

  // 거절 모달
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 요약 모달
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  const { data: consultations = [] } = useQuery({
    queryKey: ['instructor', 'consultations', courseId],
    queryFn: () => consultationsApi.getConsultations('instructor', courseId),
    staleTime: 30_000,
  });

  // 학생 목록 (상담 예약 시 선택용)
  const { data: studentList = [] } = useQuery({
    queryKey: ['instructor', 'students-for-select', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const entries = await instructorApi.getCourseHeatmap(courseId);
      return entries.map((e) => ({ id: String(e.studentId), name: e.studentName }));
    },
    enabled: !!courseId,
    staleTime: 60_000,
  });

  const filteredStudents = studentList.filter((s) =>
    s.name.includes(studentSearch)
  );

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!studentDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-student-dropdown]')) {
        setStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [studentDropdownOpen]);

  // location.state 처리 (RiskAlertBanner, UpcomingConsultationPanel, Students에서 이동 시)
  useEffect(() => {
    const state = location.state as {
      preselectedStudentId?: string;
      preselectedStudentName?: string;
      showBriefingForId?: string;
    } | null;

    if (!state) return;

    if (state.showBriefingForId) {
      setBriefingConsultationId(state.showBriefingForId);
      setBriefingModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    } else if (state.preselectedStudentId) {
      setScheduleStudentId(state.preselectedStudentId);
      setScheduleStudentName(state.preselectedStudentName ?? '');
      setScheduleModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  // 상담 예약 mutation
  const scheduleMutation = useMutation({
    mutationFn: () => {
      if (scheduleRequestId) {
        return consultationsApi.scheduleConsultation(scheduleRequestId, scheduledAt);
      }
      return consultationsApi.createConsultation({
        studentId: Number(scheduleStudentId),
        instructorId: Number(user?.id ?? 0),
        courseId: Number(courseId),
        scheduledAt,
      });
    },
    onSuccess: () => {
      setScheduleModalOpen(false);
      setScheduleStudentId('');
      setScheduleStudentName('');
      setScheduledAt('');
      setScheduleRequestId(null);
      queryClient.invalidateQueries({ queryKey: ['instructor', 'consultations'] });
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
  });

  // 상담 요청 수락/거절 mutation
  const [acceptError, setAcceptError] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: (consultationId: string) => consultationsApi.acceptConsultation(consultationId),
    onSuccess: () => {
      setAcceptError(false);
    },
    onError: () => {
      setAcceptError(true);
      setTimeout(() => setAcceptError(false), 3000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'consultations'] });
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      consultationsApi.rejectConsultation(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'consultations'] });
      setRejectModalId(null);
      setRejectReason('');
    },
  });

  // 브리핑 데이터 가져오기
  const { data: briefingData, isLoading: briefingLoading } = useQuery({
    queryKey: ['consultation', 'briefing', briefingConsultationId],
    queryFn: () => consultationsApi.getConsultationBriefing(briefingConsultationId!),
    enabled: !!briefingConsultationId && briefingModalOpen,
    staleTime: 60_000,
  });

  const [startingCall, setStartingCall] = useState<string | null>(null);

  const startConsultation = async (id: string) => {
    setStartingCall(id);
    try {
      // Call start-video which notifies the student via SSE and returns token+roomName
      const result = await api.post<{ consultationId: number; roomName: string; token: string }>(
        `/api/consultations/${id}/start-video`,
      );
      // Navigate to video call page with token so we use the same room
      navigate(`/instructor/consultation/${id}/video`, {
        state: { token: result.token, roomName: result.roomName },
      });
    } catch {
      alert('화상 통화를 시작할 수 없습니다.');
    } finally {
      setStartingCall(null);
    }
  };

  const endConsultation = () => {
    setActiveConsultationId(null);
    setView('list');
  };

  if (view === 'active' && activeConsultationId) {
    return (
      <div className="min-h-screen bg-slate-900">
        <ConsultationLayout
          briefing={<PreBriefingPanel consultationId={activeConsultationId} />}
          workspace={
            <div className="h-full flex flex-col gap-3">
              <div className="flex-1">
                <VideoPanel consultationId={Number(activeConsultationId)} role="instructor" onEndCall={endConsultation} />
              </div>
              <div className="h-48">
                <LiveNotes consultationId={activeConsultationId} />
              </div>
            </div>
          }
          summary={<PostSummaryPanel consultationId={activeConsultationId} />}
        />
      </div>
    );
  }

  const requested = consultations.filter((c) => c.status === 'REQUESTED');
  const scheduled = consultations.filter((c) => c.status === 'SCHEDULED');
  const completed = consultations.filter((c) => c.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-800">상담 관리</h1>
            <p className="text-xs text-slate-500">
              {requested.length > 0 && <span className="text-indigo-600 font-medium">요청 {requested.length}건 · </span>}
              예정 {scheduled.length}건 · 완료 {completed.length}건
            </p>
          </div>
          <button
            onClick={() => setScheduleModalOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            상담 예약
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Requested — 학생 상담 요청 */}
        {requested.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-rose-700 mb-3">학생 상담 요청</h2>
            <div className="space-y-2">
              {requested.map((c) => {
                const date = new Date(c.scheduledAt ?? c.createdAt).toLocaleDateString('ko-KR', {
                  month: 'short', day: 'numeric',
                });
                return (
                  <div key={c.id} className="bg-rose-50/80 backdrop-blur-[12px] border border-rose-200 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <span className="text-sm text-rose-500 w-14 shrink-0">{date}</span>
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-700 shrink-0">
                        {(c.studentName ?? '?').charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800">{c.studentName ?? '학생'}</span>
                        <TagChip label="요청" color="rose" size="sm" className="ml-2" />
                        {c.notes && (
                          <p className="text-xs text-slate-400 mt-0.5 max-w-md truncate">{c.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => acceptMutation.mutate(String(c.id))}
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        수락
                      </button>
                      <button
                        onClick={() => { setRejectModalId(String(c.id)); setRejectReason(''); }}
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheduled */}
        {scheduled.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">예정된 상담</h2>
            <div className="space-y-2">
              {scheduled.map((c) => {
                const dt = new Date(c.scheduledAt);
                const dateTime = dt.toLocaleDateString('ko-KR', {
                  month: 'short', day: 'numeric', weekday: 'short',
                }) + ' ' + dt.toLocaleTimeString('ko-KR', {
                  hour: '2-digit', minute: '2-digit',
                });
                const cfg = statusLabel[c.status] ?? statusLabel.SCHEDULED;
                return (
                  <div key={c.id} className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <span className="text-xs sm:text-sm font-mono font-semibold text-indigo-600 shrink-0">{dateTime}</span>
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                        {(c.studentName ?? '?').charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800">{c.studentName ?? '학생'}</span>
                        <TagChip label={cfg.text} color={cfg.color} size="sm" className="ml-2" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setBriefingConsultationId(c.id);
                          setBriefingModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-200"
                      >
                        브리핑 보기
                      </button>
                      <button
                        onClick={() => startConsultation(c.id)}
                        disabled={startingCall === c.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {startingCall === c.id ? '연결 중...' : '화상 상담'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">완료된 상담</h2>
            <div className="space-y-2">
              {completed.map((c) => {
                const date = new Date(c.scheduledAt).toLocaleDateString('ko-KR', {
                  month: 'short', day: 'numeric',
                });
                return (
                  <div key={c.id} className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <span className="text-sm text-slate-500 shrink-0">{date}</span>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {(c.studentName ?? '?').charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-700">{c.studentName ?? '학생'}</span>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-md truncate">{c.summaryText}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedConsultation(c);
                        setSummaryModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors border border-slate-300"
                    >
                      요약 보기
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {acceptError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-rose-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          상담 수락에 실패했습니다. 다시 시도해주세요.
        </div>
      )}

      {/* 상담 예약 모달 */}
      <Modal isOpen={scheduleModalOpen} onClose={() => { setScheduleModalOpen(false); setScheduleRequestId(null); }} title="상담 예약" size="sm">
        <div className="space-y-4">
          <div className="relative" data-student-dropdown>
            <label className="block text-xs font-medium text-slate-600 mb-1">학생 선택</label>
            {scheduleStudentId && scheduleStudentName ? (
              <div className="flex items-center justify-between px-3 py-2 text-sm border border-indigo-300 rounded-xl bg-indigo-50">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                    {scheduleStudentName.charAt(0)}
                  </span>
                  <span className="font-medium text-slate-800">{scheduleStudentName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleStudentId('');
                    setScheduleStudentName('');
                    setStudentSearch('');
                    setStudentDropdownOpen(true);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  변경
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentDropdownOpen(true);
                  }}
                  onFocus={() => setStudentDropdownOpen(true)}
                  placeholder="학생 이름 검색..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
                />
                {studentDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setScheduleStudentId(s.id);
                            setScheduleStudentName(s.name);
                            setStudentSearch('');
                            setStudentDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 transition-colors"
                        >
                          <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {s.name.charAt(0)}
                          </span>
                          {s.name}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-xs text-slate-400 text-center">
                        {studentSearch ? '검색 결과가 없습니다' : '학생 목록을 불러오는 중...'}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">상담 일시</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
            />
          </div>

          <button
            onClick={() => scheduleMutation.mutate()}
            disabled={!scheduleStudentId || !scheduledAt || scheduleMutation.isPending}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {scheduleMutation.isPending ? '예약 중...' : '상담 예약'}
          </button>

          {scheduleMutation.isError && (
            <p className="text-xs text-rose-500">예약 실패. 다시 시도해주세요.</p>
          )}
        </div>
      </Modal>

      {/* 브리핑 보기 모달 */}
      <Modal
        isOpen={briefingModalOpen}
        onClose={() => {
          setBriefingModalOpen(false);
          setBriefingConsultationId(null);
        }}
        title="AI 상담 브리핑"
        size="md"
      >
        {briefingLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : briefingData ? (
          (() => {
            const hasContent =
              briefingData.studentSummary ||
              (briefingData.riskAreas && briefingData.riskAreas.length > 0) ||
              (briefingData.suggestedTopics && briefingData.suggestedTopics.length > 0) ||
              (briefingData.actionHistory && briefingData.actionHistory.length > 0);

            if (!hasContent) {
              return (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-600">AI 브리핑이 아직 생성되지 않았습니다</p>
                  <p className="text-xs text-slate-400 mt-1">상담 전 AI가 학생 데이터를 분석하여 브리핑을 준비합니다.</p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {briefingData.studentSummary && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">학생 요약</h4>
                    <p className="text-sm text-slate-700 leading-relaxed">{briefingData.studentSummary}</p>
                  </div>
                )}

                {briefingData.riskAreas && briefingData.riskAreas.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                    <h4 className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-2">위험 영역</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {briefingData.riskAreas.map((area) => (
                        <TagChip key={area} label={area} color="rose" size="sm" />
                      ))}
                    </div>
                  </div>
                )}

                {briefingData.suggestedTopics && briefingData.suggestedTopics.length > 0 && (
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                    <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">추천 상담 주제</h4>
                    <ul className="space-y-1.5">
                      {briefingData.suggestedTopics.map((topic, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {briefingData.actionHistory && briefingData.actionHistory.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">이전 액션 히스토리</h4>
                    <ul className="space-y-1.5">
                      {briefingData.actionHistory.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">AI 브리핑이 아직 생성되지 않았습니다</p>
            <p className="text-xs text-slate-400 mt-1">상담 전 AI가 학생 데이터를 분석하여 브리핑을 준비합니다.</p>
          </div>
        )}
      </Modal>

      {/* 요약 보기 모달 */}
      <Modal
        isOpen={summaryModalOpen}
        onClose={() => {
          setSummaryModalOpen(false);
          setSelectedConsultation(null);
        }}
        title={`상담 요약 - ${selectedConsultation?.studentName ?? ''}`}
        size="md"
      >
        {selectedConsultation && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">요약</h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {selectedConsultation.summaryText || '요약이 아직 생성되지 않았습니다.'}
              </p>
            </div>

            {selectedConsultation.actionPlanJson && (() => {
              const raw = selectedConsultation.actionPlanJson;
              const plans: any[] = Array.isArray(raw)
                ? raw
                : typeof raw === 'string'
                  ? (() => { try { return JSON.parse(raw); } catch { return []; } })()
                  : [];
              if (plans.length === 0) return null;
              return (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                  <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">액션플랜</h4>
                  <ul className="space-y-1.5">
                    {plans.map((p: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-xs font-semibold text-indigo-600 w-12 flex-shrink-0">{p.day ?? p.dueDate ?? `Day ${i + 1}`}</span>
                        {p.task ?? p.title ?? ''}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div className="text-xs text-slate-400">
              상담일: {new Date(selectedConsultation.scheduledAt).toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* 거절 사유 입력 모달 */}
      <Modal isOpen={!!rejectModalId} onClose={() => { setRejectModalId(null); setRejectReason(''); }} title="상담 요청 거절">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">거절 사유를 입력하면 학생에게 표시됩니다.</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="거절 사유를 입력하세요 (선택사항)"
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:border-indigo-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setRejectModalId(null); setRejectReason(''); }}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => rejectModalId && rejectMutation.mutate({ id: rejectModalId, reason: rejectReason || undefined })}
              disabled={rejectMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
            >
              {rejectMutation.isPending ? '처리 중...' : '거절'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
