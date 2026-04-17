package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.consultation.Consultation;
import com.classpulse.domain.consultation.ConsultationRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import com.classpulse.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class LiveKitController {

    private final ConsultationRepository consultationRepository;
    private final UserService userService;
    private final NotificationService notificationService;

    // No defaults: LIVEKIT_API_KEY / LIVEKIT_API_SECRET must be configured per environment.
    @Value("${app.livekit.api-key:}")
    private String livekitApiKey;

    @Value("${app.livekit.api-secret:}")
    private String livekitApiSecret;

    @jakarta.annotation.PostConstruct
    void validateLiveKitConfig() {
        if (livekitApiKey == null || livekitApiKey.isBlank()) {
            throw new IllegalStateException(
                    "app.livekit.api-key is not configured. Set the LIVEKIT_API_KEY environment variable.");
        }
        if (livekitApiSecret == null || livekitApiSecret.isBlank()) {
            throw new IllegalStateException(
                    "app.livekit.api-secret is not configured. Set the LIVEKIT_API_SECRET environment variable.");
        }
        if ("devkey".equals(livekitApiKey) || "devsecret".equals(livekitApiSecret)) {
            throw new IllegalStateException(
                    "LiveKit credentials appear to be the placeholder 'devkey'/'devsecret'. Replace them.");
        }
    }

    // --- DTOs ---

    public record TokenRequest(String roomName, String participantName, Long consultationId, String role) {}

    public record TokenResponse(String token, String roomName, String participantName) {}

    public record VideoSessionResponse(
            Long consultationId, String roomName, String status, String token
    ) {}

    // --- Auth helpers ---

    private Consultation loadConsultation(Long id) {
        return consultationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Consultation not found"));
    }

    /** Throws 403 unless the current user is either the student or instructor of this consultation. */
    private void assertParticipant(Consultation consultation, Long userId) {
        Long studentId = consultation.getStudent() != null ? consultation.getStudent().getId() : null;
        Long instructorId = consultation.getInstructor() != null ? consultation.getInstructor().getId() : null;
        if (!Objects.equals(userId, studentId) && !Objects.equals(userId, instructorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a participant of this consultation");
        }
    }

    /** Throws 403 unless the current user is the assigned instructor of this consultation. */
    private void assertInstructor(Consultation consultation, Long userId) {
        Long instructorId = consultation.getInstructor() != null ? consultation.getInstructor().getId() : null;
        if (!Objects.equals(userId, instructorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned instructor can perform this action");
        }
    }

    // --- Endpoints ---

    @PostMapping("/api/livekit/token")
    @Transactional
    public ResponseEntity<TokenResponse> generateToken(@RequestBody TokenRequest request) {
        // Tokens must be bound to a consultation the caller participates in.
        // Arbitrary roomName is ignored — the server decides the room from the consultation.
        if (request.consultationId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "consultationId is required");
        }

        Long userId = SecurityUtil.getCurrentUserId();
        User user = userService.findById(userId);

        Consultation consultation = loadConsultation(request.consultationId());
        assertParticipant(consultation, userId);

        String roomName = consultation.getVideoRoomName();
        if (roomName == null || roomName.isBlank()) {
            roomName = "consultation-" + consultation.getId() + "-" + UUID.randomUUID().toString().substring(0, 8);
            consultation.setVideoRoomName(roomName);
            consultationRepository.save(consultation);
        }

        String participantName = request.participantName() != null
                ? request.participantName() : user.getName();

        String token = generateLiveKitToken(roomName, participantName);

        return ResponseEntity.ok(new TokenResponse(token, roomName, participantName));
    }

    @PostMapping("/api/consultations/{id}/start-video")
    @Transactional
    public ResponseEntity<VideoSessionResponse> startVideo(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();
        User user = userService.findById(userId);

        Consultation consultation = loadConsultation(id);
        // Only the assigned instructor may initiate an INCOMING_CALL notification.
        assertInstructor(consultation, userId);

        // Reuse existing room name if already set, otherwise generate a new one
        String roomName = consultation.getVideoRoomName();
        if (roomName == null || roomName.isBlank()) {
            roomName = "consultation-" + id + "-" + UUID.randomUUID().toString().substring(0, 8);
        }
        consultation.setVideoRoomName(roomName);
        consultation.setStatus("IN_PROGRESS");
        consultationRepository.save(consultation);

        String token = generateLiveKitToken(roomName, user.getName());
        log.info("Started video session for consultation {} in room {}", id, roomName);

        // Send INCOMING_CALL notification to the student
        Long studentId = consultation.getStudent().getId();
        notificationService.createNotification(
                studentId,
                "INCOMING_CALL",
                user.getName() + " 강사님이 화상 상담을 요청합니다",
                consultation.getCourse() != null
                        ? consultation.getCourse().getTitle() + " 과목 상담"
                        : "화상 상담",
                Map.of(
                        "consultationId", id,
                        "roomName", roomName,
                        "callerName", user.getName(),
                        "callerId", userId
                )
        );

        return ResponseEntity.ok(new VideoSessionResponse(id, roomName, "IN_PROGRESS", token));
    }

    @PostMapping("/api/consultations/{id}/end-video")
    @Transactional
    public ResponseEntity<VideoSessionResponse> endVideo(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();

        Consultation consultation = loadConsultation(id);
        // Either party can end the call.
        assertParticipant(consultation, userId);

        String roomName = consultation.getVideoRoomName();
        consultation.setStatus("VIDEO_ENDED");
        consultationRepository.save(consultation);

        log.info("Ended video session for consultation {} in room {}", id, roomName);

        return ResponseEntity.ok(new VideoSessionResponse(id, roomName, "VIDEO_ENDED", null));
    }

    // --- Helper ---

    private String generateLiveKitToken(String roomName, String participantName) {
        // LiveKit access tokens are JWTs signed with the API secret.
        // The token follows the LiveKit access token spec:
        // https://docs.livekit.io/home/get-started/authentication/
        var now = Instant.now();
        var key = Keys.hmacShaKeyFor(livekitApiSecret.getBytes(StandardCharsets.UTF_8));

        var videoGrant = Map.of(
                "roomJoin", true,
                "room", roomName,
                "canPublish", true,
                "canSubscribe", true
        );

        return Jwts.builder()
                .issuer(livekitApiKey)
                .subject(participantName)
                .claim("name", participantName)
                .claim("video", videoGrant)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .id(UUID.randomUUID().toString())
                .signWith(key)
                .compact();
    }
}
