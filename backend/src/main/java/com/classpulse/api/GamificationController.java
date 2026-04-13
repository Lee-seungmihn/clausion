package com.classpulse.api;

import com.classpulse.domain.gamification.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/gamification")
@RequiredArgsConstructor
public class GamificationController {

    private final GamificationRepository gamificationRepository;
    private final StudentBadgeRepository studentBadgeRepository;
    private final XPEventRepository xpEventRepository;

    // --- DTOs ---

    public record GamificationResponse(
            Long id, Long studentId, Long courseId,
            Integer level, Integer currentXp, Integer nextLevelXp,
            String levelTitle, Integer streakDays,
            LocalDate lastActivityDate, Integer totalXpEarned,
            LocalDateTime updatedAt
    ) {
        public static GamificationResponse from(StudentGamification g) {
            return new GamificationResponse(
                    g.getId(), g.getStudent().getId(), g.getCourse().getId(),
                    g.getLevel(), g.getCurrentXp(), g.getNextLevelXp(),
                    g.getLevelTitle(), g.getStreakDays(),
                    g.getLastActivityDate(), g.getTotalXpEarned(),
                    g.getUpdatedAt()
            );
        }
    }

    public record BadgeResponse(
            Long id, String name, String emoji, String description,
            String category, LocalDateTime earnedAt
    ) {
        public static BadgeResponse from(StudentBadge sb) {
            Badge b = sb.getBadge();
            return new BadgeResponse(
                    b.getId(), b.getName(), b.getEmoji(),
                    b.getDescription(), b.getCategory(), sb.getEarnedAt()
            );
        }
    }

    public record XPEventResponse(
            Long id, Long studentId, Long courseId,
            String eventType, Integer xpAmount,
            Long sourceId, String sourceType,
            LocalDateTime createdAt
    ) {
        public static XPEventResponse from(XPEvent e) {
            return new XPEventResponse(
                    e.getId(), e.getStudent().getId(), e.getCourse().getId(),
                    e.getEventType(), e.getXpAmount(),
                    e.getSourceId(), e.getSourceType(),
                    e.getCreatedAt()
            );
        }
    }

    public record LeaderboardEntry(
            int rank, Long studentId, String studentName,
            Integer level, String levelTitle, Integer totalXpEarned
    ) {}

    // --- Endpoints ---

    @GetMapping("/{studentId}")
    public ResponseEntity<List<GamificationResponse>> getGamification(
            @PathVariable Long studentId,
            @RequestParam(required = false) Long courseId) {
        List<StudentGamification> all;
        if (courseId != null) {
            all = gamificationRepository.findByStudentIdAndCourseId(studentId, courseId)
                    .map(List::of).orElse(List.of());
        } else {
            all = gamificationRepository.findAll().stream()
                    .filter(g -> g.getStudent().getId().equals(studentId))
                    .toList();
        }
        return ResponseEntity.ok(all.stream().map(GamificationResponse::from).toList());
    }

    @GetMapping("/{studentId}/badges")
    public ResponseEntity<List<BadgeResponse>> getBadges(@PathVariable Long studentId) {
        List<StudentBadge> badges = studentBadgeRepository.findByStudentId(studentId);
        return ResponseEntity.ok(badges.stream().map(BadgeResponse::from).toList());
    }

    @GetMapping("/{studentId}/xp-history")
    public ResponseEntity<List<XPEventResponse>> getXpHistory(@PathVariable Long studentId) {
        List<XPEvent> events = xpEventRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
        return ResponseEntity.ok(events.stream().map(XPEventResponse::from).toList());
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<LeaderboardEntry>> getLeaderboard(@RequestParam Long courseId) {
        List<StudentGamification> ranked = gamificationRepository
                .findByCourseIdOrderByTotalXpEarnedDesc(courseId);

        List<LeaderboardEntry> leaderboard = new java.util.ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            StudentGamification g = ranked.get(i);
            leaderboard.add(new LeaderboardEntry(
                    i + 1,
                    g.getStudent().getId(),
                    g.getStudent().getName(),
                    g.getLevel(),
                    g.getLevelTitle(),
                    g.getTotalXpEarned()
            ));
        }
        return ResponseEntity.ok(leaderboard);
    }
}
