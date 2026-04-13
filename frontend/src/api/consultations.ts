import { api } from './client';
import type { Consultation } from '../types';

export const consultationsApi = {
  getConsultations(role: 'student' | 'instructor' = 'student', courseId?: string): Promise<Consultation[]> {
    const params = courseId ? `&courseId=${courseId}` : '';
    return api.get<Consultation[]>(`/api/consultations?role=${role}${params}`);
  },

  createConsultation(data: {
    studentId: number;
    instructorId: number;
    courseId: number;
    scheduledAt: string;
  }): Promise<Consultation> {
    return api.post<Consultation>('/api/consultations', data);
  },

  getConsultationBriefing(consultationId: string): Promise<{
    studentSummary: string;
    riskAreas: string[];
    suggestedTopics: string[];
    actionHistory: string[];
  }> {
    return api.get(`/api/consultations/${consultationId}/briefing`);
  },

  requestConsultation(data: { courseId: number; message?: string }): Promise<{ id: number; status: string }> {
    return api.post('/api/consultations/request', data);
  },

  createSummary(
    consultationId: string,
    data: { summaryText: string; actionPlanJson: string },
  ): Promise<{ jobId: number }> {
    return api.post<{ jobId: number }>(
      `/api/consultations/${consultationId}/summary`,
      data,
    );
  },
};
