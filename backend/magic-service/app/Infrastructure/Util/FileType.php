<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use App\Infrastructure\Util\SSRF\SSRFUtil;
use Exception;
use InvalidArgumentException;
use Symfony\Component\Mime\MimeTypes;

class FileType
{
    /**
     * 获取文件类型的扩展名.
     */
    public static function getType(string $url): string
    {
        // 按优先级尝试不同的获取文件类型的方法
        try {
            // 1. 尝试从URL路径中获取
            $extensionFromUrl = self::getTypeFromUrlPath($url);
            if ($extensionFromUrl) {
                return $extensionFromUrl;
            }

            // 2. 检查本地文件
            if (file_exists($url)) {
                return self::getTypeFromLocalFile($url);
            }

            // 3. 尝试从HTTP头信息获取
            $extensionFromHeaders = self::getTypeFromHeaders($url);
            if ($extensionFromHeaders) {
                return $extensionFromHeaders;
            }

            // 4. 下载文件检查MIME类型
            return self::getTypeFromDownload($url);
        } catch (Exception $e) {
            throw new InvalidArgumentException('无法确定文件类型: ' . $e->getMessage());
        }
    }

    /**
     * 从本地文件获取类型.
     */
    private static function getTypeFromLocalFile(string $path): string
    {
        $mimeType = finfo_file(finfo_open(FILEINFO_MIME_TYPE), $path);
        $extension = self::getExtensionFromMimeType($mimeType);

        if (! $extension) {
            throw new InvalidArgumentException("无法从MIME类型 '{$mimeType}' 确定文件扩展名");
        }

        return $extension;
    }

    /**
     * 从URL路径获取类型.
     */
    private static function getTypeFromUrlPath(string $url): ?string
    {
        $parseUrl = parse_url($url);
        $path = $parseUrl['path'] ?? '';
        $fileExtension = pathinfo($path, PATHINFO_EXTENSION);

        return ! empty($fileExtension) ? strtolower($fileExtension) : null;
    }

    /**
     * 从HTTP头信息获取类型.
     */
    private static function getTypeFromHeaders(string $url): ?string
    {
        $context = self::createStreamContext();
        $headers = get_headers($url, true, $context);

        if ($headers === false || ! isset($headers['Content-Type'])) {
            return null;
        }

        $mimeType = is_array($headers['Content-Type'])
            ? $headers['Content-Type'][0]
            : $headers['Content-Type'];

        return self::getExtensionFromMimeType($mimeType);
    }

    /**
     * 通过下载文件获取类型.
     */
    private static function getTypeFromDownload(string $url): string
    {
        // 检测文件安全性
        $safeUrl = SSRFUtil::getSafeUrl($url, replaceIp: false);
        $tempFile = tempnam(sys_get_temp_dir(), 'downloaded_');

        try {
            self::downloadFile($safeUrl, $tempFile);
            self::checkFileSize($tempFile);

            // 检查文件的MIME类型
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $tempFile);
            finfo_close($finfo);

            $extension = self::getExtensionFromMimeType($mimeType);
            if (! $extension) {
                throw new InvalidArgumentException("无法从MIME类型 '{$mimeType}' 确定文件扩展名");
            }

            return $extension;
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile); // 确保临时文件被删除
            }
        }
    }

    /**
     * 创建绕过SSL验证的流上下文.
     */
    private static function createStreamContext(): mixed
    {
        return stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
    }

    /**
     * 下载文件到临时位置.
     */
    private static function downloadFile(string $url, string $tempFile): void
    {
        $context = self::createStreamContext();
        $fileStream = fopen($url, 'r', false, $context);
        $localFile = fopen($tempFile, 'w');

        if (! $fileStream || ! $localFile) {
            throw new Exception('无法打开文件流');
        }

        stream_copy_to_stream($fileStream, $localFile);

        fclose($fileStream);
        fclose($localFile);
    }

    /**
     * 检查文件大小是否超限.
     */
    private static function checkFileSize(string $filePath, int $maxSize = 52428800): void // 50MB
    {
        if (filesize($filePath) > $maxSize) {
            throw new Exception('文件太大，无法下载');
        }
    }

    /**
     * 从MIME类型获取文件扩展名.
     */
    private static function getExtensionFromMimeType(string $mimeType): ?string
    {
        $mimeTypes = new MimeTypes();
        $extensions = $mimeTypes->getExtensions($mimeType);
        return $extensions[0] ?? null; // 返回第一个匹配的扩展名
    }
}
