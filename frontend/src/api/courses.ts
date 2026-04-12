import { api } from './client';
import type { Course, CurriculumSkill } from '../types';

export const coursesApi = {
  getCourses(): Promise<Course[]> {
    return api.get<Course[]>('/api/courses');
  },

  getCourse(courseId: string): Promise<Course> {
    return api.get<Course>(`/api/courses/${courseId}`);
  },

  createCourse(data: { title: string; description: string; schedule?: string; classTime?: string }): Promise<Course> {
    return api.post<Course>('/api/courses', data);
  },

  uploadCurriculum(
    courseId: string,
    file: File,
    opts?: { target?: string; additionalPrompt?: string },
  ): Promise<{ jobId: number }> {
    const formData = new FormData();
    formData.append('file', file);
    if (opts?.target) formData.append('target', opts.target);
    if (opts?.additionalPrompt) formData.append('additionalPrompt', opts.additionalPrompt);

    const token = localStorage.getItem('token');
    return fetch(`/api/courses/${courseId}/curriculum`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? `Upload failed: ${res.status}`);
      }
      return res.json();
    });
  },

  enrollInCourse(courseId: string): Promise<void> {
    return api.post<void>(`/api/courses/${courseId}/enroll`);
  },

  getMyEnrollments(): Promise<{ enrollmentId: number; courseId: number; studentId: number; status: string }[]> {
    return api.get('/api/courses/my-enrollments');
  },

  getSkills(courseId: string): Promise<CurriculumSkill[]> {
    return api.get<CurriculumSkill[]>(`/api/courses/${courseId}/skills`);
  },

  updateSkill(courseId: string, skillId: string, data: Partial<CurriculumSkill>): Promise<CurriculumSkill> {
    return api.put<CurriculumSkill>(`/api/courses/${courseId}/skills/${skillId}`, data);
  },

  createSkill(courseId: string, data: { name: string; description: string; difficulty: string }): Promise<CurriculumSkill> {
    return api.post<CurriculumSkill>(`/api/courses/${courseId}/skills`, data);
  },

  deleteSkill(courseId: string, skillId: string): Promise<void> {
    return api.delete<void>(`/api/courses/${courseId}/skills/${skillId}`);
  },

  createDefaultSkills(courseId: string): Promise<CurriculumSkill[]> {
    return api.post<CurriculumSkill[]>(`/api/courses/${courseId}/skills/defaults`);
  },
};
