<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * Content-Type utility for file type detection and browser behavior control.
 */
class ContentTypeUtil
{
    /**
     * File extension to Content-Type mapping.
     * Based on TOS documentation: https://www.volcengine.com/docs/6349/145523#%E5%B8%B8%E8%A7%81%E7%9A%84-content-type.
     */
    private static array $contentTypeMap = [
        // Images - 图片类型
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'tiff' => 'image/tiff',
        'tif' => 'image/tiff',

        // Videos - 视频类型
        'mp4' => 'video/mp4',
        'avi' => 'video/x-msvideo',
        'mov' => 'video/quicktime',
        'wmv' => 'video/x-ms-wmv',
        'flv' => 'video/x-flv',
        'webm' => 'video/webm',
        'mkv' => 'video/x-matroska',
        '3gp' => 'video/3gpp',

        // Audio - 音频类型
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'flac' => 'audio/flac',
        'aac' => 'audio/aac',
        'ogg' => 'audio/ogg',
        'wma' => 'audio/x-ms-wma',
        'm4a' => 'audio/mp4',

        // Documents - 文档类型
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'rtf' => 'application/rtf',
        'odt' => 'application/vnd.oasis.opendocument.text',
        'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
        'odp' => 'application/vnd.oasis.opendocument.presentation',

        // Text - 文本类型
        'txt' => 'text/plain',
        'csv' => 'text/csv',
        'html' => 'text/html',
        'htm' => 'text/html',
        'xml' => 'text/xml',
        'css' => 'text/css',
        'js' => 'text/javascript',
        'json' => 'application/json',
        'md' => 'text/markdown',
        'yaml' => 'text/yaml',
        'yml' => 'text/yaml',

        // Code - 代码类型
        'php' => 'text/x-php',
        'py' => 'text/x-python',
        'java' => 'text/x-java-source',
        'cpp' => 'text/x-c++src',
        'c' => 'text/x-csrc',
        'h' => 'text/x-chdr',
        'sh' => 'text/x-shellscript',
        'sql' => 'text/x-sql',

        // Archives - 压缩文件
        'zip' => 'application/zip',
        'rar' => 'application/vnd.rar',
        '7z' => 'application/x-7z-compressed',
        'tar' => 'application/x-tar',
        'gz' => 'application/gzip',
        'bz2' => 'application/x-bzip2',

        // Other common types - 其他常见类型
        'exe' => 'application/vnd.microsoft.portable-executable',
        'dmg' => 'application/x-apple-diskimage',
        'iso' => 'application/x-iso9660-image',
        'apk' => 'application/vnd.android.package-archive',
        'deb' => 'application/vnd.debian.binary-package',
        'rpm' => 'application/x-rpm',
    ];

    /**
     * File extensions that can be previewed in browser.
     * These files are safe to display inline.
     */
    private static array $previewableExtensions = [
        // Images
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',

        // Text files
        'txt', 'csv', 'html', 'htm', 'xml', 'css', 'js', 'json', 'md',

        // Documents that browsers can handle
        'pdf',

        // Code files
        'php', 'py', 'java', 'cpp', 'c', 'h', 'sh', 'sql', 'yaml', 'yml',

        // Videos (modern browsers support)
        'mp4', 'webm',

        // Audio
        'mp3', 'wav', 'ogg', 'm4a',
    ];

    /**
     * Get Content-Type for a file based on its extension.
     *
     * @param string $filename File name or path
     * @return string Content-Type string
     */
    public static function getContentType(string $filename): string
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return self::$contentTypeMap[$extension] ?? 'application/octet-stream';
    }

    /**
     * Check if a file can be previewed in browser.
     *
     * @param string $filename File name or path
     * @return bool True if file can be previewed
     */
    public static function isPreviewable(string $filename): bool
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return in_array($extension, self::$previewableExtensions, true);
    }

    /**
     * Get Content-Disposition header value based on download mode.
     *
     * @param string $downloadMode Download mode: 'download', 'preview', or 'inline'
     * @param string $filename File name for download
     * @return string Content-Disposition header value
     */
    public static function getContentDisposition(string $downloadMode, string $filename): string
    {
        $safeFilename = addslashes($filename);

        switch (strtolower($downloadMode)) {
            case 'download':
                return "attachment; filename=\"{$safeFilename}\"";
            case 'preview':
            case 'inline':
                // Check if file is previewable
                if (self::isPreviewable($filename)) {
                    return "inline; filename=\"{$safeFilename}\"";
                }
                // Force download for non-previewable files
                return "attachment; filename=\"{$safeFilename}\"";
            default:
                return "attachment; filename=\"{$safeFilename}\"";
        }
    }

    /**
     * Get all supported Content-Type mappings.
     *
     * @return array Extension to Content-Type mapping
     */
    public static function getAllContentTypes(): array
    {
        return self::$contentTypeMap;
    }

    /**
     * Get all previewable file extensions.
     *
     * @return array List of previewable extensions
     */
    public static function getPreviewableExtensions(): array
    {
        return self::$previewableExtensions;
    }

    /**
     * Add or update a Content-Type mapping.
     *
     * @param string $extension File extension (without dot)
     * @param string $contentType Content-Type string
     * @param bool $isPreviewable Whether the file type is previewable
     */
    public static function addContentType(string $extension, string $contentType, bool $isPreviewable = false): void
    {
        $extension = strtolower($extension);
        self::$contentTypeMap[$extension] = $contentType;

        if ($isPreviewable && ! in_array($extension, self::$previewableExtensions, true)) {
            self::$previewableExtensions[] = $extension;
        }
    }

    /**
     * Build Content-Disposition header following HTTP standards and browser compatibility.
     *
     * @param string $filename Original filename
     * @param string $disposition Disposition type ('attachment' for download, 'inline' for preview)
     * @return string Content-Disposition header value
     */
    public static function buildContentDispositionHeader(string $filename, string $disposition = 'attachment'): string
    {
        // Validate disposition type
        $disposition = strtolower($disposition);
        if (! in_array($disposition, ['attachment', 'inline'], true)) {
            $disposition = 'attachment';
        }

        // For inline disposition, return simple format
        if ($disposition === 'inline') {
            return 'inline';
        }

        // For attachment, handle filename encoding
        return self::buildAttachmentDisposition($filename);
    }

    /**
     * Build attachment Content-Disposition with proper filename encoding.
     *
     * @param string $filename Original filename
     * @return string Content-Disposition header value
     */
    private static function buildAttachmentDisposition(string $filename): string
    {
        $escapedFilename = addslashes($filename);

        // Check if filename contains non-ASCII characters
        if (preg_match('/[^\x20-\x7E]/', $filename)) {
            // Non-ASCII characters: use RFC 5987 encoding for better compatibility
            $encodedFilename = rawurlencode($filename);

            return sprintf(
                'attachment; filename="%s"; filename*=UTF-8\'\'%s',
                $escapedFilename,  // Basic compatibility
                $encodedFilename   // RFC 5987 standard
            );
        }

        // ASCII-only filename: use simple format
        return sprintf('attachment; filename="%s"', $escapedFilename);
    }
}
