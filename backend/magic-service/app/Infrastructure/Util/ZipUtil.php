<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use RuntimeException;
use Swow\Psr7\Message\UploadedFile;
use ZipArchive;

/**
 * ZIP 文件工具类.
 * 提供 ZIP 文件解压、验证等通用方法.
 */
class ZipUtil
{
    private const MAX_EXTRACTED_FILE_SIZE = 100 * 1024 * 1024;

    /**
     * 从 ZIP 中提取指定文件，不解压其他内容.
     */
    public static function extractFile(
        string $zipFile,
        string $fileName,
        string $target,
        int $maxExtractedSize = self::MAX_EXTRACTED_FILE_SIZE
    ): void {
        if ($fileName === '' || basename($fileName) !== $fileName) {
            throw new RuntimeException('Invalid ZIP file name');
        }

        $zip = new ZipArchive();
        if ($zip->open($zipFile) !== true) {
            throw new RuntimeException('Failed to open ZIP file');
        }

        try {
            $rootEntry = null;
            $wrapperEntries = [];
            for ($index = 0; $index < $zip->numFiles; ++$index) {
                $name = $zip->getNameIndex($index);
                if ($name === false || str_ends_with($name, '/')) {
                    continue;
                }

                $normalizedName = str_replace('\\', '/', $name);
                if ($normalizedName === $fileName) {
                    $rootEntry = $name;
                    break;
                }

                $segments = explode('/', $normalizedName);
                if (count($segments) !== 2
                    || $segments[0] === ''
                    || $segments[0] === '__MACOSX'
                    || $segments[1] !== $fileName
                ) {
                    continue;
                }

                $wrapperEntries[$normalizedName] = $name;
            }

            $entryName = $rootEntry;
            if ($entryName === null && $wrapperEntries !== []) {
                ksort($wrapperEntries, SORT_STRING);
                $entryName = reset($wrapperEntries);
            }

            if (! is_string($entryName)) {
                throw new RuntimeException($fileName . ' not found');
            }

            $entryIndex = $zip->locateName($entryName);
            $entryStat = $entryIndex === false ? false : $zip->statIndex($entryIndex);
            if ($entryStat === false || ! isset($entryStat['size'])) {
                throw new RuntimeException('Failed to inspect ' . $fileName);
            }
            if ($entryStat['size'] > $maxExtractedSize) {
                throw new RuntimeException($fileName . ' exceeds maximum allowed size: ' . $maxExtractedSize . ' bytes');
            }

            $stream = $zip->getStream($entryName);
            $output = fopen($target, 'wb');
            if ($stream === false || $output === false) {
                throw new RuntimeException('Failed to extract ' . $fileName);
            }

            $copied = stream_copy_to_stream($stream, $output, $maxExtractedSize + 1);
            fclose($stream);
            fclose($output);
            if ($copied === false || $copied > $maxExtractedSize) {
                throw new RuntimeException($fileName . ' exceeds maximum allowed size: ' . $maxExtractedSize . ' bytes');
            }
        } finally {
            $zip->close();
        }
    }

    /**
     * 解压 ZIP 文件到指定目录.
     *
     * @param string|UploadedFile $zipFile ZIP 文件路径或 UploadedFile 对象
     * @param string $extractTo 解压目标目录
     * @param null|int $maxExtractedSize 最大解压后总大小限制（字节），null 表示不限制
     * @throws RuntimeException 当 ZIP 文件打开失败或解压后大小超限时抛出异常
     */
    public static function extract(string|UploadedFile $zipFile, string $extractTo, ?int $maxExtractedSize = null): void
    {
        // 确保目标目录存在
        if (! is_dir($extractTo)) {
            mkdir($extractTo, 0755, true);
        }

        // 处理 UploadedFile 对象
        $tempFile = null;
        if ($zipFile instanceof UploadedFile) {
            $tempFile = $zipFile->getStream()->getMetadata('uri') ?? tempnam(sys_get_temp_dir(), 'zip_');
            if ($tempFile !== $zipFile->getStream()->getMetadata('uri')) {
                file_put_contents($tempFile, $zipFile->getStream()->getContents());
            }
            $zipFilePath = $tempFile;
        } else {
            $zipFilePath = $zipFile;
        }

        $zip = new ZipArchive();
        if ($zip->open($zipFilePath) !== true) {
            if ($tempFile && file_exists($tempFile) && $tempFile !== ($zipFile instanceof UploadedFile ? $zipFile->getStream()->getMetadata('uri') : null)) {
                unlink($tempFile);
            }
            throw new RuntimeException('Failed to open ZIP file');
        }

        try {
            // 检查解压后总大小（防止 Zip Bomb）
            if ($maxExtractedSize !== null) {
                $totalSize = 0;
                for ($i = 0; $i < $zip->numFiles; ++$i) {
                    $stat = $zip->statIndex($i);
                    if ($stat === false) {
                        continue;
                    }
                    $totalSize += $stat['size'];
                    if ($totalSize > $maxExtractedSize) {
                        throw new RuntimeException('Extracted file size exceeds maximum allowed size: ' . $maxExtractedSize . ' bytes');
                    }
                }
            }

            // 解压文件
            if (! $zip->extractTo($extractTo)) {
                throw new RuntimeException('Failed to extract ZIP file');
            }
        } finally {
            $zip->close();
            // 清理临时文件
            if ($tempFile && file_exists($tempFile) && $tempFile !== ($zipFile instanceof UploadedFile ? $zipFile->getStream()->getMetadata('uri') : null)) {
                unlink($tempFile);
            }
        }
    }

    /**
     * 获取 ZIP 文件解压后的总大小.
     *
     * @param string|UploadedFile $zipFile ZIP 文件路径或 UploadedFile 对象
     * @return int 解压后总大小（字节）
     * @throws RuntimeException 当 ZIP 文件打开失败时抛出异常
     */
    public static function getExtractedSize(string|UploadedFile $zipFile): int
    {
        // 处理 UploadedFile 对象
        $tempFile = null;
        if ($zipFile instanceof UploadedFile) {
            $tempFile = $zipFile->getStream()->getMetadata('uri') ?? tempnam(sys_get_temp_dir(), 'zip_');
            if ($tempFile !== $zipFile->getStream()->getMetadata('uri')) {
                file_put_contents($tempFile, $zipFile->getStream()->getContents());
            }
            $zipFilePath = $tempFile;
        } else {
            $zipFilePath = $zipFile;
        }

        $zip = new ZipArchive();
        if ($zip->open($zipFilePath) !== true) {
            if ($tempFile && file_exists($tempFile) && $tempFile !== ($zipFile instanceof UploadedFile ? $zipFile->getStream()->getMetadata('uri') : null)) {
                unlink($tempFile);
            }
            throw new RuntimeException('Failed to open ZIP file');
        }

        try {
            $totalSize = 0;
            for ($i = 0; $i < $zip->numFiles; ++$i) {
                $stat = $zip->statIndex($i);
                if ($stat === false) {
                    continue;
                }
                $totalSize += $stat['size'];
            }
            return $totalSize;
        } finally {
            $zip->close();
            // 清理临时文件
            if ($tempFile && file_exists($tempFile) && $tempFile !== ($zipFile instanceof UploadedFile ? $zipFile->getStream()->getMetadata('uri') : null)) {
                unlink($tempFile);
            }
        }
    }

    /**
     * 验证 ZIP 文件是否可以正常打开.
     *
     * @param string|UploadedFile $zipFile ZIP 文件路径或 UploadedFile 对象
     * @return bool 如果 ZIP 文件可以正常打开返回 true，否则返回 false
     */
    public static function isValid(string|UploadedFile $zipFile): bool
    {
        // 处理 UploadedFile 对象
        $tempFile = null;
        if ($zipFile instanceof UploadedFile) {
            $tempFile = $zipFile->getStream()->getMetadata('uri') ?? tempnam(sys_get_temp_dir(), 'zip_');
            if ($tempFile !== $zipFile->getStream()->getMetadata('uri')) {
                file_put_contents($tempFile, $zipFile->getStream()->getContents());
            }
            $zipFilePath = $tempFile;
        } else {
            $zipFilePath = $zipFile;
        }

        $zip = new ZipArchive();
        $result = $zip->open($zipFilePath) === true;
        if ($result) {
            $zip->close();
        }

        // 清理临时文件
        if ($tempFile && file_exists($tempFile) && $tempFile !== ($zipFile instanceof UploadedFile ? $zipFile->getStream()->getMetadata('uri') : null)) {
            unlink($tempFile);
        }

        return $result;
    }

    /**
     * Compress a directory into a ZIP archive.
     * Uses addFile() to avoid loading file contents into memory.
     *
     * @param string $sourceDir Source directory to compress
     * @param string $zipFilePath Target ZIP file path
     * @param null|string $rootDirName Optional root directory name inside the ZIP (defaults to source dir basename)
     * @throws RuntimeException When ZIP creation fails
     */
    public static function compress(string $sourceDir, string $zipFilePath, ?string $rootDirName = null): void
    {
        if (! is_dir($sourceDir)) {
            throw new RuntimeException('Source directory does not exist: ' . $sourceDir);
        }

        $zip = new ZipArchive();
        if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Failed to create ZIP file: ' . $zipFilePath);
        }

        $rootName = $rootDirName ?? basename($sourceDir);

        try {
            self::addDirectoryToZip($zip, $sourceDir, $rootName);
        } finally {
            $zip->close();
        }
    }

    /**
     * 递归删除目录及其所有内容.
     *
     * @param string $dir 要删除的目录路径
     */
    public static function removeDirectory(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                self::removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }

    /**
     * Recursively add directory contents to a ZipArchive.
     */
    private static function addDirectoryToZip(ZipArchive $zip, string $localDir, string $zipPath): void
    {
        $zip->addEmptyDir($zipPath);

        $items = array_diff(scandir($localDir), ['.', '..']);
        foreach ($items as $item) {
            $localPath = $localDir . '/' . $item;
            $entryPath = $zipPath . '/' . $item;

            if (is_dir($localPath)) {
                self::addDirectoryToZip($zip, $localPath, $entryPath);
            } else {
                $zip->addFile($localPath, $entryPath);
            }
        }
    }
}
