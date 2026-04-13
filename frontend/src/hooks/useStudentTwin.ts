import { useQuery } from '@tanstack/react-query';
import { twinApi } from '../api/twin';
import type { StudentTwin, SkillMasterySnapshot } from '../types';

export function useStudentTwin(studentId: string, courseId?: string) {
  return useQuery<StudentTwin | null>({
    queryKey: ['studentTwin', studentId, courseId],
    queryFn: () => twinApi.getStudentTwin(studentId, courseId),
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

export function useStudentTwinHistory(studentId: string, courseId?: string) {
  return useQuery<SkillMasterySnapshot[]>({
    queryKey: ['studentTwinHistory', studentId, courseId],
    queryFn: () => twinApi.getTwinHistory(studentId, courseId),
    enabled: !!studentId,
  });
}
