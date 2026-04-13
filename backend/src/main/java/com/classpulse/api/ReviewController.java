package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.learning.ReviewScheduler;
import com.classpulse.domain.learning.ReviewTask;
import com.classpulse.domain.learning.ReviewTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewTaskRepository reviewTaskRepository;
    private final ReviewScheduler reviewScheduler;
    private final CourseEnrollmentRepository enrollmentRepository;

    // --- DTOs ---

    public record ReviewTaskResponse(
            Long id, Long studentId, Long courseId, Long skillId,
            String title, String reasonSummary,
            LocalDate scheduledFor, String status,
            LocalDateTime completedAt, LocalDateTime createdAt
    ) {
        public static ReviewTaskResponse from(ReviewTask t) {
            return new ReviewTaskResponse(
                    t.getId(),
                    t.getStudent().getId(),
                    t.getCourse().getId(),
                    t.getSkill() != null ? t.getSkill().getId() : null,
                    t.getTitle(),
                    t.getReasonSummary(),
                    t.getScheduledFor(),
                    t.getStatus(),
                    t.getCompletedAt(),
                    t.getCreatedAt()
            );
        }
    }

    // --- Endpoints ---

    @GetMapping("/today")
    public ResponseEntity<List<ReviewTaskResponse>> today(
            @RequestParam(required = false) Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        LocalDate today = LocalDate.now();

        // Fetch pending/in-progress tasks scheduled for today or earlier (includes overdue)
        List<ReviewTask> tasks = reviewTaskRepository
                .findByStudentIdAndScheduledForLessThanEqualAndStatusIn(
                        userId, today, List.of("PENDING", "IN_PROGRESS"));

        // Filter by courseId if provided
        if (courseId != null) {
            tasks = tasks.stream().filter(t -> t.getCourse().getId().equals(courseId)).toList();
        }

        // If no tasks exist, auto-generate from enrolled courses
        if (tasks.isEmpty()) {
            var enrollments = enrollmentRepository.findByStudentIdAndStatus(userId, "ACTIVE");
            for (var enrollment : enrollments) {
                if (courseId != null && !enrollment.getCourse().getId().equals(courseId)) continue;
                List<ReviewTask> generated = reviewScheduler.generateReviewTasks(userId, enrollment.getCourse().getId());
                tasks.addAll(generated);
            }
        }

        return ResponseEntity.ok(tasks.stream().map(ReviewTaskResponse::from).toList());
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<ReviewTaskResponse> complete(@PathVariable Long id) {
        ReviewTask task = reviewTaskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Review task not found: " + id));

        // Verify ownership
        Long userId = SecurityUtil.getCurrentUserId();
        if (!task.getStudent().getId().equals(userId)) {
            return ResponseEntity.status(403).build();
        }

        task.complete();
        task = reviewTaskRepository.save(task);
        return ResponseEntity.ok(ReviewTaskResponse.from(task));
    }

    @GetMapping("/by-student")
    public ResponseEntity<List<ReviewTaskResponse>> byStudent(
            @RequestParam Long studentId,
            @RequestParam Long courseId
    ) {
        List<ReviewTask> tasks = reviewTaskRepository
                .findByStudentIdAndCourseIdOrderByScheduledForDesc(studentId, courseId);
        return ResponseEntity.ok(tasks.stream().map(ReviewTaskResponse::from).toList());
    }

    @GetMapping("/week")
    public ResponseEntity<List<ReviewTaskResponse>> week(
            @RequestParam(required = false) Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);
        List<ReviewTask> tasks = reviewTaskRepository
                .findByStudentIdAndScheduledForBetweenOrderByScheduledFor(userId, weekStart, today);
        if (courseId != null) {
            tasks = tasks.stream().filter(t -> t.getCourse().getId().equals(courseId)).toList();
        }
        return ResponseEntity.ok(tasks.stream().map(ReviewTaskResponse::from).toList());
    }

    public record WeekDaySummary(String date, String dayLabel, int total, int completed, String status) {}

    @GetMapping("/week-summary")
    public ResponseEntity<List<WeekDaySummary>> weekSummary(
            @RequestParam(required = false) Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);

        List<ReviewTask> tasks = reviewTaskRepository
                .findByStudentIdAndScheduledForBetweenOrderByScheduledFor(userId, weekStart, today);

        if (courseId != null) {
            tasks = tasks.stream().filter(t -> t.getCourse().getId().equals(courseId)).toList();
        }

        // Group tasks by date
        Map<LocalDate, List<ReviewTask>> byDate = tasks.stream()
                .collect(Collectors.groupingBy(ReviewTask::getScheduledFor));

        String[] dayLabels = {"일", "월", "화", "수", "목", "금", "토"};
        List<WeekDaySummary> result = new ArrayList<>();

        for (int i = 0; i < 7; i++) {
            LocalDate date = weekStart.plusDays(i);
            String dayLabel = dayLabels[date.getDayOfWeek().getValue() % 7];
            List<ReviewTask> dayTasks = byDate.getOrDefault(date, List.of());

            int total = dayTasks.size();
            int completed = (int) dayTasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();

            String status;
            if (date.equals(today)) {
                status = "today";
            } else if (total == 0) {
                status = "future";
            } else if (completed == total) {
                status = "completed";
            } else if (completed > 0) {
                status = "partial";
            } else {
                status = "missed";
            }

            result.add(new WeekDaySummary(date.toString(), dayLabel, total, completed, status));
        }

        return ResponseEntity.ok(result);
    }
}
