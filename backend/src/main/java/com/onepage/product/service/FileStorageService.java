package com.onepage.product.service;

import com.onepage.product.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
