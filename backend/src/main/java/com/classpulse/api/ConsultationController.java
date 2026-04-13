package com.classpulse.api;

import com.classpulse.ai.ConsultationCopilot;
import com.classpulse.ai.TwinInferenceDebouncer;
import com.classpulse.config.SecurityUtil;
import com.classpulse.notification.NotificationService;
import com.classpulse.domain.consultation.Consultation;
import com.classpulse.domain.consultation.ConsultationRepository;
import com.classpulse.domain.consultation.ConsultationService;
import com.classpulse.domain.course.AsyncJob;
import com.classpulse.domain.course.AsyncJobRepository;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
public class ConsultationController {

    private final ConsultationService consultationService;
    private final ConsultationRepository consultationRepository;
    private final AsyncJobRepository asyncJobRepository;
    private final ConsultationAiService consultationAiService;
    private final NotificationService notificationService;
    private final CourseRepository courseRepository;
    private final UserRepository userRepository;

    // --- DTOs ---

    public record CreateConsultationRequest(
            Long studentId,
            Long instructorId,
            Long courseId,
            LocalDateTime scheduledAt
    ) {}

    public record ConsultationResponse(
            Long id, Long studentId, String studentName,
            Long instructorId, String instructorName,
            Long courseId, String courseTitle,
            LocalDateTime scheduledAt, String status,
            String notes, String summaryText, String causeAnalysis,
            List<Map<String, Object>> actionPlanJson,
            Map<String, Object> briefingJson,
            String videoRoomName,
            LocalDateTime createdAt, LocalDateTime completedAt
    ) {
        public static ConsultationResponse from(Consultation c) {
            return new ConsultationResponse(
                    c.getId(),
                    c.getStudent().getId(), c.getStudent().getName(),
                    c.getInstructor().getId(), c.getInstructor().getName(),
                    c.getCourse().getId(), c.getCourse().getTitle(),
                    c.getScheduledAt(), c.getStatus(),
                    c.getNotes(), c.getSummaryText(), c.getCauseAnalysis(),
                    c.getActionPlanJson(), c.getBriefingJson(),
                    c.getVideoRoomName(),
                    c.getCreatedAt(), c.getCompletedAt()
            );
        }
    }

    public record UpdateNotesRequest(String notes) {}

    public record JobIdResponse(Long jobId) {}

    // --- Endpoints ---

    @PostMapping
    public ResponseEntity<ConsultationResponse> create(@RequestBody CreateConsultationRequest request) {
        Consultation consultation = consultationService.createConsultation(
                request.studentId(), request.instructorId(),
                request.courseId(), request.scheduledAt()
        );

        // Notify both parties about the scheduled consultation
        notificationService.createNotification(
                request.studentId(),
                "CONSULTATION_SCHEDULED",
                "상담이 예약되었습니다",
                String.format("%s 과목 상담이 %s에 예정되어 있습니다.",
                        consultation.getCourse().getTitle(),
                        consultation.getScheduledAt().toLocalDate()),
                Map.of("consultationId", consultation.getId(), "courseId", request.courseId())
        );
        notificationService.createNotification(
                request.instructorId(),
                "CONSULTATION_SCHEDULED",
                "새 상담 요청: " + consultation.getStudent().getName(),
                String.format("%s 학생과의 %s 과목 상담이 %s에 예정되어 있습니다.",
                        consultation.getStudent().getName(),
                        consultation.getCourse().getTitle(),
                        consultation.getScheduledAt().toLocalDate()),
                Map.of("consultationId", consultation.getId(), "studentId", request.studentId())
        );

        // Auto-generate briefing asynchronously
        consultationAiService.generateBriefing(consultation.getId());

        return ResponseEntity.status(HttpStatus.CREATED).body(ConsultationResponse.from(consultation));
    }

    @PostMapping("/request")
    @Transactional
    public ResponseEntity<?> requestConsultation(@RequestBody Map<String, Object> body) {
        Long studentId = SecurityUtil.getCurrentUserId();
        Long courseId = Long.valueOf(body.get("courseId").toString());
        String message = body.containsKey("message") ? body.get("message").toString() : "";

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("과정을 찾을 수 없습니다"));
        if (course.getCreatedBy() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "해당 과정에 담당 강사가 없습니다"));
        }
        Long instructorId = course.getCreatedBy().getId();

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("학생 정보를 찾을 수 없습니다"));

        Consultation consultation = Consultation.builder()
                .student(student)
                .instructor(course.getCreatedBy())
                .course(course)
                .scheduledAt(LocalDateTime.now().plusDays(7))
                .status("REQUESTED")
                .notes(message)
                .build();
        consultation = consultationRepository.save(consultation);

        notificationService.createNotification(
                instructorId,
                "CONSULTATION_REQUESTED",
                "새 상담 요청: " + student.getName(),
                student.getName() + " 학생이 " + course.getTitle() + " 과목 상담을 요청했습니다.",
                Map.of("consultationId", consultation.getId(), "studentId", studentId, "courseId", courseId)
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(ConsultationResponse.from(consultation));
    }

    @GetMapping
    public ResponseEntity<List<ConsultationResponse>> list(
            @RequestParam String role,
            @RequestParam(required = false) Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        List<Consultation> consultations;

        if ("instructor".equalsIgnoreCase(role)) {
            consultations = consultationService.getByInstructorId(userId);
        } else {
            consultations = consultationService.getByStudentId(userId);
        }

        if (courseId != null) {
            consultations = consultations.stream()
                    .filter(c -> c.getCourse().getId().equals(courseId))
                    .toList();
        }

        return ResponseEntity.ok(consultations.stream().map(ConsultationResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConsultationResponse> getById(@PathVariable Long id) {
        Consultation consultation = consultationService.getById(id);
        return ResponseEntity.ok(ConsultationResponse.from(consultation));
    }

    @GetMapping("/{id}/briefing")
    public ResponseEntity<Map<String, Object>> getBriefing(@PathVariable Long id) {
        Consultation consultation = consultationService.getById(id);
        Map<String, Object> briefing = consultation.getBriefingJson();
        if (briefing == null) {
            briefing = Map.of("message", "Briefing not yet generated");
        }
        return ResponseEntity.ok(briefing);
    }

    @PostMapping("/{id}/summary")
    public ResponseEntity<JobIdResponse> triggerSummary(@PathVariable Long id) {
        AsyncJob job = AsyncJob.builder()
                .jobType("CONSULTATION_SUMMARY")
                .status("PENDING")
                .inputPayload(Map.of("consultationId", id))
                .build();
        job = asyncJobRepository.save(job);

        consultationAiService.generateSummary(job.getId(), id);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new JobIdResponse(job.getId()));
    }

    @PutMapping("/{id}/notes")
    public ResponseEntity<ConsultationResponse> updateNotes(
            @PathVariable Long id,
            @RequestBody UpdateNotesRequest request
    ) {
        Consultation consultation = consultationService.getById(id);
        consultation.setNotes(request.notes());
        consultation = consultationRepository.save(consultation);
        return ResponseEntity.ok(ConsultationResponse.from(consultation));
    }

    // --- Async Service ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    static class ConsultationAiService {

        private final AsyncJobRepository asyncJobRepository;
        private final ConsultationService consultationService;
        private final ConsultationCopilot consultationCopilot;
        private final TwinInferenceDebouncer twinInferenceDebouncer;

        @Async("aiTaskExecutor")
        public void generateSummary(Long jobId, Long consultationId) {
            AsyncJob job = asyncJobRepository.findById(jobId).orElseThrow();
            try {
                job.setStatus("PROCESSING");
                asyncJobRepository.save(job);

                Consultation consultation = consultationService.getById(consultationId);

                log.info("Generating AI summary for consultation {} via ConsultationCopilot", consultationId);

                // Call ConsultationCopilot to generate summary with twin context
                Map<String, Object> summaryResult = consultationCopilot.generateSummary(
                        consultationId, consultation.getNotes());

                job.complete(Map.of("consultationId", consultationId, "message", "Summary generated"));
                asyncJobRepository.save(job);

                // Trigger debounced twin inference after consultation summary
                twinInferenceDebouncer.requestInference(
                        consultation.getStudent().getId(), consultation.getCourse().getId(), "CONSULTATION");

            } catch (Exception e) {
                log.error("Summary generation failed for consultation {}", consultationId, e);
                job.fail(e.getMessage());
                asyncJobRepository.save(job);
            }
        }

        @Async("aiTaskExecutor")
        public void generateBriefing(Long consultationId) {
            try {
                log.info("Generating AI briefing for consultation {} via ConsultationCopilot", consultationId);
                consultationCopilot.generateBriefing(consultationId);
            } catch (Exception e) {
                log.error("Briefing generation failed for consultation {}", consultationId, e);
            }
        }
    }
}
