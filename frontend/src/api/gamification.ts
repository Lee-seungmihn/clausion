import { api } from './client';
import type { GamificationState, Badge } from '../types';

// Backend GamificationResponse field mapping
interface BackendGamificationResponse {
  id: number;
  studentId: number;
  courseId: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  levelTitle: string;
  streakDays: number;
  lastActivityDate: string;
  totalXpEarned: number;
  updatedAt: string;
}

export const gamificationApi = {
  // Backend returns List<GamificationResponse>, we map first element to GamificationState
  async getGamificationState(studentId: string, courseId?: string): Promise<GamificationState> {
    const params = courseId ? `?courseId=${courseId}` : '';
    const list = await api.get<BackendGamificationResponse[]>(`/api/gamification/${studentId}${params}`);
    const g = list[0];
    if (!g) {
      return { level: 1, currentXP: 0, nextLevelXP: 100, levelTitle: '', streakDays: 0, badges: [] };
    }
    return {
      level: g.level,
      currentXP: g.currentXp,
      nextLevelXP: g.nextLevelXp,
      levelTitle: g.levelTitle,
      streakDays: g.streakDays,
      badges: [],
    };
  },

  getBadges(studentId: string): Promise<Badge[]> {
    return api.get<Badge[]>(`/api/gamification/${studentId}/badges`);
  },

  getXPHistory(studentId: string): Promise<{ date: string; xp: number; event: string }[]> {
    return api.get(`/api/gamification/${studentId}/xp-history`);
  },

  getLeaderboard(courseId: string): Promise<{
    rank: number;
    studentId: number;
    studentName: string;
    totalXpEarned: number;
    level: number;
    levelTitle: string;
  }[]> {
    return api.get(`/api/gamification/leaderboard?courseId=${courseId}`);
  },
};
