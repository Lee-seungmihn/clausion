package com.classpulse.api;

import com.classpulse.ai.CurriculumAnalyzer;
import com.classpulse.domain.course.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/courses/{courseId}")
@RequiredArgsConstructor
public class CurriculumController {

    private final CourseRepository courseRepository;
    private final CurriculumSkillRepository skillRepository;
    private final AsyncJobRepository asyncJobRepository;
    private final CurriculumAsyncService curriculumAsyncService;

    // --- DTOs ---

    public record SkillResponse(
            Long id, String name, String description, String difficulty,
            List<Long> prerequisiteIds
    ) {
        public static SkillResponse from(CurriculumSkill s) {
            List<Long> prereqs = s.getPrerequisites().stream()
                    .map(CurriculumSkill::getId).toList();
            return new SkillResponse(s.getId(), s.getName(), s.getDescription(), s.getDifficulty(), prereqs);
        }
    }

    public record UpdateSkillRequest(String name, String description, String difficulty) {}

    public record CreateSkillRequest(String name, String description, String difficulty) {}

    public record JobIdResponse(Long jobId) {}

    // --- Endpoints ---

    @PostMapping("/curriculum")
    public ResponseEntity<JobIdResponse> uploadCurriculum(
            @PathVariable Long courseId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "target", required = false, defaultValue = "") String target,
            @RequestParam(value = "additionalPrompt", required = false, defaultValue = "") String additionalPrompt
    ) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

        String content;
        try {
            content = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }

        AsyncJob job = AsyncJob.builder()
                .jobType("CURRICULUM_ANALYSIS")
                .status("PENDING")
                .inputPayload(Map.of(
                        "courseId", courseId,
                        "fileName", file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown",
                        "contentLength", content.length()
                ))
                .build();
        job = asyncJobRepository.save(job);

        // target과 additionalPrompt를 objectives로 합쳐서 전달
        String objectives = "";
        if (!target.isBlank()) objectives += "대상: " + target + "\n";
        if (!additionalPrompt.isBlank()) objectives += "추가 요청: " + additionalPrompt + "\n";

        curriculumAsyncService.analyzeCurriculum(job.getId(), courseId, content, objectives);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new JobIdResponse(job.getId()));
    }

    @Transactional(readOnly = true)
    @GetMapping("/skills")
    public ResponseEntity<List<SkillResponse>> getSkills(@PathVariable Long courseId) {
        List<CurriculumSkill> skills = skillRepository.findByCourseId(courseId);
        return ResponseEntity.ok(skills.stream().map(SkillResponse::from).toList());
    }

    @PutMapping("/skills/{skillId}")
    public ResponseEntity<SkillResponse> updateSkill(
            @PathVariable Long courseId,
            @PathVariable Long skillId,
            @RequestBody UpdateSkillRequest request
    ) {
        CurriculumSkill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + skillId));

        if (!skill.getCourse().getId().equals(courseId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (request.name() != null) skill.setName(request.name());
        if (request.description() != null) skill.setDescription(request.description());
        if (request.difficulty() != null) skill.setDifficulty(request.difficulty());

        skill = skillRepository.save(skill);
        return ResponseEntity.ok(SkillResponse.from(skill));
    }

    @PostMapping("/skills")
    public ResponseEntity<SkillResponse> createSkill(
            @PathVariable Long courseId,
            @RequestBody CreateSkillRequest request
    ) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

        CurriculumSkill skill = CurriculumSkill.builder()
                .course(course)
                .name(request.name())
                .description(request.description())
                .difficulty(request.difficulty() != null ? request.difficulty() : "MEDIUM")
                .build();
        skill = skillRepository.save(skill);
        return ResponseEntity.status(HttpStatus.CREATED).body(SkillResponse.from(skill));
    }

    @PostMapping("/skills/defaults")
    @Transactional
    public ResponseEntity<List<SkillResponse>> createDefaultSkills(@PathVariable Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

        // 이미 스킬이 있으면 중복 생성 방지
        if (!skillRepository.findByCourseId(courseId).isEmpty()) {
            return ResponseEntity.ok(skillRepository.findByCourseId(courseId).stream()
                    .map(SkillResponse::from).toList());
        }

        var defaults = List.of(
                new String[]{"변수와 데이터 타입", "변수 선언, 기본 데이터 타입(int, string, boolean 등), 타입 변환", "EASY"},
                new String[]{"조건문", "if/else, switch/case, 삼항 연산자를 활용한 흐름 제어", "EASY"},
                new String[]{"반복문", "for, while, do-while 루프와 break/continue 활용", "EASY"},
                new String[]{"배열과 리스트", "배열 선언, 인덱싱, 슬라이싱, 리스트 조작 메서드", "EASY"},
                new String[]{"함수와 메서드", "함수 정의, 매개변수, 반환값, 스코프, 순수 함수", "MEDIUM"},
                new String[]{"문자열 처리", "문자열 메서드, 포매팅, 정규표현식 기초, 파싱", "MEDIUM"},
                new String[]{"객체지향 프로그래밍", "클래스, 객체, 상속, 다형성, 캡슐화, 추상화", "MEDIUM"},
                new String[]{"예외 처리", "try/catch, 예외 계층, 커스텀 예외, 에러 핸들링 전략", "MEDIUM"},
                new String[]{"재귀 함수", "재귀 호출, 기저 조건, 꼬리 재귀, 메모이제이션", "HARD"},
                new String[]{"자료구조", "스택, 큐, 해시맵, 트리, 그래프의 개념과 활용", "HARD"},
                new String[]{"정렬과 탐색 알고리즘", "버블/선택/삽입/퀵/병합 정렬, 이진 탐색", "HARD"},
                new String[]{"클로저와 고차 함수", "클로저 개념, map/filter/reduce, 콜백 패턴", "HARD"},
                new String[]{"비동기 프로그래밍", "콜백, Promise, async/await, 이벤트 루프", "HARD"},
                new String[]{"디자인 패턴", "싱글톤, 팩토리, 옵저버, 전략 패턴 등 핵심 패턴", "HARD"},
                new String[]{"테스트와 디버깅", "단위 테스트, 테스트 주도 개발, 디버깅 기법", "MEDIUM"}
        );

        List<CurriculumSkill> created = new java.util.ArrayList<>();
        for (String[] d : defaults) {
            CurriculumSkill skill = CurriculumSkill.builder()
                    .course(course)
                    .name(d[0])
                    .description(d[1])
                    .difficulty(d[2])
                    .build();
            created.add(skillRepository.save(skill));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(created.stream().map(SkillResponse::from).toList());
    }

    @DeleteMapping("/skills/{skillId}")
    public ResponseEntity<Void> deleteSkill(
            @PathVariable Long courseId,
            @PathVariable Long skillId
    ) {
        CurriculumSkill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + skillId));

        if (!skill.getCourse().getId().equals(courseId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        skillRepository.delete(skill);
        return ResponseEntity.noContent().build();
    }

    // --- Async Service (inner class) ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    static class CurriculumAsyncService {

        private final AsyncJobRepository asyncJobRepository;
        private final CurriculumSkillRepository skillRepository;
        private final CourseRepository courseRepository;
        private final CurriculumAnalyzer curriculumAnalyzer;

        @Async("aiTaskExecutor")
        public void analyzeCurriculum(Long jobId, Long courseId, String content, String objectives) {
            AsyncJob job = asyncJobRepository.findById(jobId).orElseThrow();
            try {
                job.setStatus("PROCESSING");
                asyncJobRepository.save(job);

                log.info("Analyzing curriculum for course {} via CurriculumAnalyzer (content length: {})",
                        courseId, content.length());

                Map<String, Object> analysisResult = curriculumAnalyzer.analyze(courseId, content, objectives);

                // 전체 AI 분석 결과를 job resultPayload에 저장
                Map<String, Object> result = new java.util.HashMap<>();
                result.put("courseId", courseId);
                result.put("message", "Curriculum analysis completed");
                result.put("skillsExtracted", analysisResult.getOrDefault("skillCount", 0));
                result.put("weekly_concepts", analysisResult.getOrDefault("weekly_concepts", List.of()));
                result.put("common_misconceptions", analysisResult.getOrDefault("common_misconceptions", List.of()));
                result.put("review_points", analysisResult.getOrDefault("review_points", List.of()));

                job.complete(result);
                asyncJobRepository.save(job);

            } catch (Exception e) {
                log.error("Curriculum analysis failed for job {}", jobId, e);
                job.fail(e.getMessage());
                asyncJobRepository.save(job);
            }
        }
    }
}
