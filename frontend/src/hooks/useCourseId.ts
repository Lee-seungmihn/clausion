import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '../api/courses';
import { useCourseStore } from '../store/courseStore';
import type { Course } from '../types';

export function useCourses() {
  return useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => coursesApi.getCourses(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseId(): string | undefined {
  const { data: courses } = useCourses();
  const { selectedCourseId, setSelectedCourseId } = useCourseStore();

  // If a course is explicitly selected and it still exists in the list, use it
  if (selectedCourseId && courses?.some((c) => String(c.id) === selectedCourseId)) {
    return selectedCourseId;
  }

  // Auto-select the first course with enrollments, or just the first one
  const fallback = courses?.find((c) => (c.enrollmentCount ?? 0) > 0) ?? courses?.[0];
  const fallbackId = fallback?.id?.toString();

  // Persist the auto-selected course
  if (fallbackId && fallbackId !== selectedCourseId) {
    setSelectedCourseId(fallbackId);
  }

  return fallbackId;
}
