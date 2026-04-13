package com.classpulse.api;

import com.classpulse.domain.course.*;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/seed")
@RequiredArgsConstructor
public class SeedController {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final StudentTwinRepository twinRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/students/{courseId}")
    @Transactional
    public ResponseEntity<Map<String, Object>> seedStudents(@PathVariable Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

        List<String[]> studentData = List.of(
                new String[]{"kim.minjun@student.com", "김민준"},
                new String[]{"lee.soyeon@student.com", "이소연"},
                new String[]{"park.jiwoo@student.com", "박지우"},
                new String[]{"choi.hyunwoo@student.com", "최현우"},
                new String[]{"jung.yuna@student.com", "정유나"},
                new String[]{"han.dogyeom@student.com", "한도겸"},
                new String[]{"oh.seojin@student.com", "오서진"},
                new String[]{"kang.haneul@student.com", "강하늘"}
        );

        // 각 학생의 트윈 프리셋 (다양한 학습 패턴)
        BigDecimal[][] twinPresets = {
                // mastery, execution, retentionRisk, motivation, consultNeed, overallRisk
                {bd(82), bd(78), bd(15), bd(88), bd(10), bd(12)},   // 김민준: 우수
                {bd(65), bd(60), bd(35), bd(55), bd(45), bd(48)},   // 이소연: 주의 필요
                {bd(91), bd(88), bd(8),  bd(95), bd(5),  bd(6)},    // 박지우: 최상위
                {bd(40), bd(35), bd(65), bd(30), bd(75), bd(78)},   // 최현우: 위험
                {bd(73), bd(70), bd(25), bd(72), bd(20), bd(22)},   // 정유나: 양호
                {bd(55), bd(48), bd(50), bd(45), bd(55), bd(58)},   // 한도겸: 주의
                {bd(78), bd(82), bd(18), bd(80), bd(15), bd(16)},   // 오서진: 양호-우수
                {bd(30), bd(25), bd(75), bd(20), bd(85), bd(85)}    // 강하늘: 고위험
        };

        String[] insights = {
                "자바 기초 문법과 OOP 개념을 잘 이해하고 있으며, 프로젝트 과제에서도 안정적인 수행을 보입니다.",
                "기본 문법은 이해하지만, 객체지향 설계에서 어려움을 겪고 있습니다. 인터페이스와 추상 클래스 부분 보강이 필요합니다.",
                "모든 영역에서 뛰어난 성과를 보이며, 동기들의 학습을 도와주는 리더십도 발휘하고 있습니다.",
                "수업 참여도가 낮고, 과제 제출이 지연되는 경향이 있습니다. 1:1 상담을 통한 동기부여가 시급합니다.",
                "꾸준한 학습 패턴을 보이며, 복습 주기를 잘 지키고 있습니다. 알고리즘 응용 부분에서 더 성장할 수 있습니다.",
                "출석은 양호하나, 코딩 실습에서 진전이 더딘 편입니다. 예외 처리와 컬렉션 프레임워크에 집중 필요합니다.",
                "실행력이 높고 프로젝트에 적극 참여합니다. Spring 프레임워크 학습에 대한 의욕이 높습니다.",
                "최근 3주간 출석이 불규칙하며, 과제 미제출이 반복되고 있습니다. 긴급 상담이 필요합니다."
        };

        String[] trends = {"IMPROVING", "DECLINING", "STABLE", "DECLINING", "IMPROVING", "DECLINING", "IMPROVING", "DECLINING"};
        String[] trendExps = {
                "지난 2주간 과제 점수가 10점 이상 향상되었습니다.",
                "최근 퀴즈 성적이 3회 연속 하락하고 있습니다.",
                "전체적으로 안정적인 학습 곡선을 유지하고 있습니다.",
                "과제 제출률과 출석률 모두 하락 추세입니다.",
                "복습 태스크 완료율이 60%에서 85%로 개선되었습니다.",
                "실습 점수가 평균 이하로 떨어지고 있습니다.",
                "코드 리뷰 점수가 꾸준히 상승하고 있습니다.",
                "3주 연속 과제 미제출, 출석률 40% 이하입니다."
        };

        List<Map<String, Object>> results = new ArrayList<>();
        String password = passwordEncoder.encode("test1234");

        for (int i = 0; i < studentData.size(); i++) {
            String email = studentData.get(i)[0];
            String name = studentData.get(i)[1];

            // 사용자 생성 또는 기존 사용자 찾기
            User user = userRepository.findByEmail(email).orElseGet(() -> {
                User u = User.builder()
                        .email(email)
                        .passwordHash(password)
                        .name(name)
                        .role(User.Role.STUDENT)
                        .build();
                return userRepository.save(u);
            });

            // 수강 신청 (중복 방지)
            if (!enrollmentRepository.existsByCourseIdAndStudentId(courseId, user.getId())) {
                CourseEnrollment enrollment = CourseEnrollment.builder()
                        .course(course)
                        .student(user)
                        .status("ACTIVE")
                        .build();
                enrollmentRepository.save(enrollment);
            }

            // 트윈 생성/업데이트
            BigDecimal[] preset = twinPresets[i];
            StudentTwin twin = twinRepository.findByStudentIdAndCourseId(user.getId(), courseId)
                    .orElseGet(() -> StudentTwin.builder()
                            .student(user)
                            .course(course)
                            .build());

            twin.setMasteryScore(preset[0]);
            twin.setExecutionScore(preset[1]);
            twin.setRetentionRiskScore(preset[2]);
            twin.setMotivationScore(preset[3]);
            twin.setConsultationNeedScore(preset[4]);
            twin.setOverallRiskScore(preset[5]);
            twin.setAiInsight(insights[i]);
            twin.setTrendDirection(trends[i]);
            twin.setTrendExplanation(trendExps[i]);
            twin.setInferenceSource("SEED_DATA");
            twinRepository.save(twin);

            results.add(Map.of(
                    "userId", user.getId(),
                    "name", name,
                    "email", email,
                    "overallRisk", preset[5]
            ));
        }

        log.info("Seeded {} students with twins for course {}", results.size(), courseId);
        return ResponseEntity.ok(Map.of(
                "message", "Students and twins seeded successfully",
                "courseId", courseId,
                "students", results
        ));
    }

    private static BigDecimal bd(int val) {
        return BigDecimal.valueOf(val);
    }
}
