import { useQuery } from '@tanstack/react-query';
import { gamificationApi } from '../api/gamification';
import type { GamificationState, Badge } from '../types';

export function useGamification(studentId: string, courseId?: string) {
  return useQuery<GamificationState>({
    queryKey: ['gamification', studentId, courseId],
    queryFn: () => gamificationApi.getGamificationState(studentId, courseId),
    enabled: !!studentId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useBadges(studentId: string) {
  return useQuery<Badge[]>({
    queryKey: ['badges', studentId],
    queryFn: () => gamificationApi.getBadges(studentId),
    enabled: !!studentId,
  });
}

export function useXPHistory(studentId: string) {
  return useQuery<{ date: string; xp: number; event: string }[]>({
    queryKey: ['xpHistory', studentId],
    queryFn: () => gamificationApi.getXPHistory(studentId),
    enabled: !!studentId,
  });
}
