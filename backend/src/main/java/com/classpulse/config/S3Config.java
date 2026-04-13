package com.classpulse.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Slf4j
@Configuration
public class S3Config {

    @Value("${app.aws.s3.region:ap-northeast-2}")
    private String region;

    @Value("${app.aws.s3.access-key:}")
    private String accessKey;

    @Value("${app.aws.s3.secret-key:}")
    private String secretKey;

    @Bean
    public S3Client s3Client() {
        if (accessKey == null || accessKey.isBlank() || secretKey == null || secretKey.isBlank()) {
            log.warn("AWS S3 credentials not configured. File upload disabled. access-key present: {}, secret-key present: {}",
                    accessKey != null && !accessKey.isBlank(), secretKey != null && !secretKey.isBlank());
            return null;
        }
        log.info("S3Client 생성: region={}, accessKey={}...", region, accessKey.substring(0, Math.min(4, accessKey.length())));
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        if (accessKey == null || accessKey.isBlank() || secretKey == null || secretKey.isBlank()) {
            return null;
        }
        return S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
    }
}
