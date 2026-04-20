package com.onepage.product.service;

import com.onepage.product.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class FileStorageService {

    private static final long MAX_FILE_SIZE = 2 * 1024 * 1024L; // 2MB
    private static final List<String> ALLOWED_CONTENT_TYPES =
            Arrays.asList("image/jpeg", "image/png", "image/webp");

    @Value("${file.upload.local-path}")
    private String localPath;

    @Value("${file.upload.base-url}")
    private String baseUrl;

    @Value("${file.upload.storage-type:local}")
    private String storageType;

    @Value("${aws.s3.bucket:}")
    private String s3Bucket;

    @Value("${aws.s3.region:}")
    private String s3Region;

    @Value("${aws.s3.access-key:}")
    private String s3AccessKey;

    @Value("${aws.s3.secret-key:}")
    private String s3SecretKey;

    private S3Client s3Client;

    @PostConstruct
    public void init() {
        if ("s3".equals(storageType)) {
            s3Client = S3Client.builder()
                    .region(Region.of(s3Region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(s3AccessKey, s3SecretKey)))
                    .build();
            log.info("S3 file storage initialized: bucket={}, region={}", s3Bucket, s3Region);
        }
    }

    public void validateImage(MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("單張圖片上限 2MB", HttpStatus.BAD_REQUEST);
        }
        if (!ALLOWED_CONTENT_TYPES.contains(file.getContentType())) {
            throw new BusinessException("僅支援 JPG/PNG/WebP 格式", HttpStatus.BAD_REQUEST);
        }
    }

    public String storeImage(MultipartFile file) {
        validateImage(file);
        if ("s3".equals(storageType)) {
            return storeToS3(file);
        }
        return storeToLocal(file);
    }

    private String storeToS3(MultipartFile file) {
        try {
            String filename = UUID.randomUUID() + getExtension(file.getOriginalFilename());
            String key = "products/" + filename;

            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(s3Bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putRequest,
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            String url = String.format("https://%s.s3.%s.amazonaws.com/%s",
                    s3Bucket, s3Region, key);
            log.debug("File uploaded to S3: {}", url);
            return url;
        } catch (IOException e) {
            log.error("Failed to upload file to S3", e);
            throw new BusinessException("圖片上傳失敗", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String storeToLocal(MultipartFile file) {
        try {
            Path uploadDir = Paths.get(localPath, "products");
            Files.createDirectories(uploadDir);

            String filename = UUID.randomUUID() + getExtension(file.getOriginalFilename());
            Path destination = uploadDir.resolve(filename);
            Files.copy(file.getInputStream(), destination);

            return baseUrl + "/uploads/products/" + filename;
        } catch (IOException e) {
            log.error("Failed to store file", e);
            throw new BusinessException("圖片上傳失敗", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".jpg";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}
