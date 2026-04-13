package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileUploadController {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${app.aws.s3.bucket:clausion}")
    private String bucket;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    public FileUploadController(
            @Autowired(required = false) S3Client s3Client,
            @Autowired(required = false) S3Presigner s3Presigner) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        if (s3Client == null) {
            log.warn("S3 not configured, upload rejected");
            return ResponseEntity.status(503).body(Map.of("error", "파일 업로드 서비스가 설정되지 않았습니다."));
        }

        Long userId = SecurityUtil.getCurrentUserId();

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일이 비어있습니다."));
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일 크기는 10MB 이하만 가능합니다."));
        }

        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf('.'));
        }
        String key = "group-chat/" + userId + "/" + UUID.randomUUID() + ext;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .contentDisposition("inline; filename=\"" + originalName + "\"")
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            String downloadUrl = generatePresignedUrl(key);

            return ResponseEntity.ok(Map.of(
                    "fileKey", key,
                    "fileName", originalName != null ? originalName : "file",
                    "fileSize", file.getSize(),
                    "contentType", file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                    "url", downloadUrl
            ));
        } catch (Exception e) {
            log.error("S3 업로드 실패: userId={}, fileName={}, bucket={}, error={}",
                    userId, originalName, bucket, e.getMessage(), e);
            String detail = e.getMessage() != null ? e.getMessage() : "알 수 없는 오류";
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "파일 업로드에 실패했습니다.",
                    "detail", detail
            ));
        }
    }

    @GetMapping("/download-url")
    public ResponseEntity<?> getDownloadUrl(@RequestParam String fileKey) {
        if (s3Presigner == null) {
            return ResponseEntity.status(503).body(Map.of("error", "파일 다운로드 서비스가 설정되지 않았습니다."));
        }
        SecurityUtil.getCurrentUserId();
        String url = generatePresignedUrl(fileKey);
        return ResponseEntity.ok(Map.of("url", url));
    }

    private String generatePresignedUrl(String key) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofDays(7))
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }
}
