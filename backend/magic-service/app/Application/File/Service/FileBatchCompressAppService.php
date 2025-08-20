<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Service;

use App\Domain\File\Constant\FileBatchConstant;
use App\Domain\File\Event\FileBatchCompressEvent;
use App\Domain\File\Service\FileCleanupDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;
use ZipArchive;

/**
 * File batch compression application service.
 */
class FileBatchCompressAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    /**
     * Collection of temporary files created during processing.
     * @var array<string>
     */
    private array $tempFiles = [];

    /**
     * Collection of open streams that need to be closed.
     * @var array<resource>
     */
    private array $openStreams = [];

    /**
     * Collection of temporary directories created during processing.
     * @var array<string>
     */
    private array $tempDirectories = [];

    /**
     * Base temporary directory for batch compress operations.
     */
    private string $baseTempDir = '';

    /**
     * Current cache key for the batch operation.
     */
    private string $currentCacheKey = '';

    private StorageBucketType $storageBucketType = StorageBucketType::Private;

    public function __construct(
        private readonly FileDomainService $fileDomainService,
        private readonly FileCleanupDomainService $fileCleanupDomainService,
        private readonly FileBatchStatusManager $statusManager,
    ) {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get('FileBatchCompress');
    }

    /**
     * Process file batch compression from event.
     *
     * @return array Processing result
     */
    public function processBatchCompressFromEvent(FileBatchCompressEvent $event): array
    {
        $this->storageBucketType = $event->getBucketType();
        return $this->processBatchCompress(
            $event->getCacheKey(),
            $event->getOrganizationCode(),
            $event->getFiles(),
            $event->getWorkdir(),
            $event->getTargetName(),
            $event->getTargetPath(),
        );
    }

    /**
     * Process file batch compression.
     *
     * @param string $cacheKey Cache key for the batch task
     * @param string $organizationCode Organization code
     * @param array $files Files to compress (format: ['file_id' => ['file_key' => '...', 'file_name' => '...']])
     * @param string $workdir Working directory
     * @param string $targetName Target file name for the compressed file
     * @param string $targetPath Target path for the compressed file
     * @return array Processing result
     */
    public function processBatchCompress(
        string $cacheKey,
        string $organizationCode,
        array $files,
        string $workdir,
        string $targetName = '',
        string $targetPath = ''
    ): array {
        try {
            // Set current cache key for use in private methods
            $this->currentCacheKey = $cacheKey;

            // Initialize base temporary directory for this batch
            // Initialize base temporary directory for this batch
            $this->createTempDirectory($cacheKey);

            $this->statusManager->setTaskProgress($cacheKey, 0, count($files), 'Starting batch compress');

            // Step 1: Get download links for all files
            $fileLinks = $this->getFileDownloadLinks($organizationCode, $files);

            if (empty($fileLinks)) {
                return [
                    'success' => false,
                    'error' => 'No valid file links found',
                ];
            }

            $this->logger->info('Successfully obtained file download links', [
                'cache_key' => $cacheKey,
                'file_count' => count($fileLinks),
                'valid_links' => count(array_filter($fileLinks, fn ($link) => ! empty($link['url']))),
            ]);

            // Step 2: Process files - download, compress and upload
            $result = $this->processFileBatch($cacheKey, $organizationCode, $fileLinks, $workdir, $targetName, $targetPath);

            if ($result['success']) {
                $this->statusManager->setTaskCompleted($cacheKey, [
                    'download_url' => $result['download_url'],
                    'file_count' => $result['file_count'],
                    'zip_size' => $result['zip_size'],
                    'expires_at' => $result['expires_at'],
                    'zip_file_name' => $result['zip_file_name'] ?? '',
                    'zip_file_key' => $result['zip_file_key'] ?? '',
                ]);

                $this->logger->info('File batch compress completed successfully', [
                    'cache_key' => $cacheKey,
                    'file_count' => $result['file_count'],
                    'zip_size_mb' => round($result['zip_size'] / 1024 / 1024, 2),
                ]);
            } else {
                $this->statusManager->setTaskFailed($cacheKey, $result['error']);
                $this->logger->error('File batch compress failed', [
                    'cache_key' => $cacheKey,
                    'error' => $result['error'],
                ]);
            }

            return $result;
        } catch (Throwable $exception) {
            $this->logger->error('Error in processBatchCompress', [
                'cache_key' => $cacheKey,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);

            $this->statusManager->setTaskFailed($cacheKey, $exception->getMessage());

            return [
                'success' => false,
                'error' => 'File processing failed: ' . $exception->getMessage(),
            ];
        } finally {
            // Fallback cleanup: ensure all temporary resources are properly cleaned up
            $this->cleanupAllTempResources();

            // Reset current cache key
            $this->currentCacheKey = '';

            $this->logger->debug('Completed cleanup of all temporary resources', [
                'cache_key' => $cacheKey,
            ]);
        }
    }

    /**
     * Create and ensure temporary directory exists.
     */
    private function createTempDirectory(string $cacheKey, string $subDir = ''): string
    {
        if (empty($this->baseTempDir)) {
            $this->baseTempDir = sys_get_temp_dir() . '/batch_compress/' . $cacheKey;
        }

        $targetDir = $this->baseTempDir;
        if (! empty($subDir)) {
            $targetDir .= '/' . trim($subDir, '/');
        }

        if (! is_dir($targetDir)) {
            if (! mkdir($targetDir, 0755, true)) {
                throw new RuntimeException("Failed to create temporary directory: {$targetDir}");
            }
            $this->tempDirectories[] = $targetDir;
            $this->logger->debug('Created temporary directory', ['dir' => $targetDir]);
        }

        return $targetDir;
    }

    /**
     * Register temporary file for cleanup.
     */
    private function registerTempFile(string $filePath): void
    {
        if (! in_array($filePath, $this->tempFiles, true)) {
            $this->tempFiles[] = $filePath;
        }
    }

    /**
     * Cleanup all temporary files, streams and directories.
     */
    private function cleanupAllTempResources(): void
    {
        // Close all open streams
        foreach ($this->openStreams as $stream) {
            if (is_resource($stream)) {
                try {
                    fclose($stream);
                    $this->logger->debug('Closed stream resource');
                } catch (Throwable $e) {
                    $this->logger->warning('Failed to close stream', ['error' => $e->getMessage()]);
                }
            }
        }
        $this->openStreams = [];

        // Remove all temporary files
        foreach ($this->tempFiles as $tempFile) {
            if (file_exists($tempFile)) {
                try {
                    unlink($tempFile);
                    $this->logger->debug('Removed temporary file', ['file' => $tempFile]);
                } catch (Throwable $e) {
                    $this->logger->warning('Failed to remove temporary file', [
                        'file' => $tempFile,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
        $this->tempFiles = [];

        // Remove all temporary directories (in reverse order to handle nested directories)
        $tempDirs = array_reverse($this->tempDirectories);
        foreach ($tempDirs as $tempDir) {
            if (is_dir($tempDir)) {
                try {
                    // Try to remove directory if it's empty
                    if ($this->isDirectoryEmpty($tempDir)) {
                        rmdir($tempDir);
                        $this->logger->debug('Removed temporary directory', ['dir' => $tempDir]);
                    }
                } catch (Throwable $e) {
                    $this->logger->warning('Failed to remove temporary directory', [
                        'dir' => $tempDir,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
        $this->tempDirectories = [];

        // Reset base temp dir
        $this->baseTempDir = '';
    }

    /**
     * Check if directory is empty.
     */
    private function isDirectoryEmpty(string $dir): bool
    {
        $handle = opendir($dir);
        if (! $handle) {
            return false;
        }

        while (false !== ($entry = readdir($handle))) {
            if ($entry !== '.' && $entry !== '..') {
                closedir($handle);
                return false;
            }
        }
        closedir($handle);
        return true;
    }

    /**
     * Get current cache key.
     */
    private function getCurrentCacheKey(): string
    {
        return $this->currentCacheKey;
    }

    /**
     * Get download links for all files.
     * @param array $files Format: ['file_id' => ['file_key' => '...', 'file_name' => '...']]
     * @return array Format: ['file_id' => ['url' => '...', 'expires' => ..., 'path' => '...', 'file_name' => '...']]
     */
    private function getFileDownloadLinks(string $organizationCode, array $files): array
    {
        if (empty($files)) {
            return [];
        }

        $this->logger->debug('Getting file download links', [
            'organization_code' => $organizationCode,
            'file_count' => count($files),
        ]);

        // Extract file keys from the new format
        $fileKeys = [];
        foreach ($files as $fileId => $fileData) {
            if (isset($fileData['file_key'])) {
                $fileKeys[] = $fileData['file_key'];
            }
        }

        $fileLinks = [];

        try {
            // Use FileDomainService to get download links
            $links = $this->fileDomainService->getLinks($organizationCode, $fileKeys, $this->storageBucketType);

            // Map the results back to file_id => link_data format
            foreach ($files as $fileId => $fileData) {
                $fileKey = $fileData['file_key'] ?? '';
                $fileName = $fileData['file_name'] ?? '';

                /** @var null|FileLink $fileLink */
                $fileLink = $links[$fileKey] ?? null;

                if ($fileLink) {
                    $fileLinks[$fileId] = [
                        'url' => $fileLink->getUrl(),
                        'path' => $fileLink->getPath(),
                        'expires' => $fileLink->getExpires(),
                        'download_name' => $fileLink->getDownloadName() ?: $fileName,
                        'file_name' => $fileName,
                    ];
                } else {
                    $this->logger->warning('File link not found', [
                        'file_id' => $fileId,
                        'file_key' => $fileKey,
                    ]);
                    $fileLinks[$fileId] = [
                        'url' => '',
                        'path' => $fileKey,
                        'expires' => 0,
                        'download_name' => $fileName,
                        'file_name' => $fileName,
                    ];
                }
            }

            $this->logger->debug('File links retrieved', [
                'total_files' => count($files),
                'valid_links' => count(array_filter($fileLinks, fn ($link) => ! empty($link['url']))),
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('Error getting file download links', [
                'error' => $exception->getMessage(),
                'organization_code' => $organizationCode,
                'file_keys' => $fileKeys,
            ]);
            throw $exception;
        }

        return $fileLinks;
    }

    /**
     * Process file batch - download, compress and upload using ZipStream-PHP.
     * @param array $fileLinks Format: ['file_id' => ['url' => '...', 'path' => '...', ...]]
     * @param string $targetName Target file name for the compressed file
     * @param string $targetPath Target path for the compressed file
     */
    private function processFileBatch(
        string $cacheKey,
        string $organizationCode,
        array $fileLinks,
        string $workdir,
        string $targetName = '',
        string $targetPath = ''
    ): array {
        $tempZipPath = null;

        try {
            $this->logger->info('Starting ZipStream file batch processing', [
                'cache_key' => $cacheKey,
                'file_count' => count($fileLinks),
                'target_name' => $targetName,
                'target_path' => $targetPath,
            ]);

            // Step 1: Use ZipStream-PHP for streaming compression to temporary file
            $tempZipPath = $this->streamCompressFiles($cacheKey, $organizationCode, $fileLinks, $workdir);

            if (empty($tempZipPath) || ! file_exists($tempZipPath)) {
                return [
                    'success' => false,
                    'error' => 'No files were successfully processed or temporary file not created',
                ];
            }

            // Step 2: Upload compressed file to storage with custom name and path
            $zipFileName = ! empty($targetName) ? $targetName : 'batch_files_' . date('Y-m-d_H-i-s') . '.zip';
            $uploadResult = $this->uploadCompressedFile($organizationCode, $tempZipPath, $zipFileName, $targetPath ?: $workdir);

            if (! $uploadResult['success']) {
                return [
                    'success' => false,
                    'error' => 'Failed to upload compressed file: ' . $uploadResult['error'],
                ];
            }

            // Step 3: Generate download link with proper filename for Content-Disposition
            $downloadNames = [$uploadResult['file_key'] => $zipFileName];
            $downloadLink = $this->generateDownloadLink($organizationCode, $uploadResult['file_key'], $downloadNames);

            // @phpstan-ignore-next-line (defensive programming - file might not exist in edge cases)
            $zipSize = file_exists($tempZipPath) ? filesize($tempZipPath) : 0;

            return [
                'success' => true,
                'download_url' => $downloadLink ? $downloadLink->getUrl() : '',
                'file_count' => count($fileLinks),
                'zip_size' => $zipSize,
                'expires_at' => $downloadLink ? $downloadLink->getExpires() : (time() + FileBatchConstant::TTL_TASK_STATUS),
                'zip_file_name' => $zipFileName,
                'zip_file_key' => $uploadResult['file_key'],
            ];
        } catch (Throwable $exception) {
            $this->logger->error('Error in processFileBatch', [
                'cache_key' => $cacheKey,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => 'File processing failed: ' . $exception->getMessage(),
            ];
        } finally {
            // Clean up temporary ZIP file
            if ($tempZipPath && file_exists($tempZipPath)) {
                unlink($tempZipPath);
                $this->logger->debug('Cleaned up temporary ZIP file', [
                    'temp_zip_path' => $tempZipPath,
                ]);
            }
        }
    }

    /**
     * Compress files using PHP ZipArchive for perfect UTF-8 compatibility.
     */
    private function streamCompressFiles(string $cacheKey, string $organizationCode, array $fileLinks, string $workdir): string
    {
        $this->logger->info('Starting ZipArchive compression of file batch', ['cache_key' => $cacheKey, 'file_count' => count($fileLinks)]);

        // Create compression subdirectory and generate temporary ZIP file
        $compressDir = $this->createTempDirectory($cacheKey, 'compress');
        $tempZipPath = $compressDir . '/batch_compress_' . uniqid() . '.zip';
        $this->registerTempFile($tempZipPath);

        // Use ZipArchive for perfect UTF-8 compatibility
        $zip = new ZipArchive();
        $result = $zip->open($tempZipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        if ($result !== true) {
            throw new RuntimeException("Failed to create ZIP file: {$result}");
        }

        $processedCount = 0;
        $totalFiles = count($fileLinks);
        $memoryBefore = memory_get_usage(true);

        try {
            foreach ($fileLinks as $fileId => $linkData) {
                $this->addFileToZipArchive($zip, (string) $fileId, $linkData, $cacheKey, $organizationCode, $workdir);
                ++$processedCount;

                // Update progress
                $progress = round(($processedCount / $totalFiles) * 100, 2);
                $this->statusManager->setTaskProgress($cacheKey, $processedCount, $totalFiles, "Processing file {$processedCount}/{$totalFiles}");

                $this->logger->debug('File added to ZIP archive', [
                    'cache_key' => $cacheKey,
                    'file_id' => $fileId,
                    'progress' => $progress,
                    'memory_usage' => memory_get_usage(true) - $memoryBefore,
                ]);
            }

            // Set UTF-8 archive comment (standard encoding)
            $zip->setArchiveComment('UTF-8编码的ZIP文件，支持中文文件名');

            // Complete compression
            $zip->close();

            $memoryPeak = memory_get_peak_usage(true);
            $fileSize = file_exists($tempZipPath) ? filesize($tempZipPath) : 0;

            $this->logger->info('ZipArchive compression completed', [
                'cache_key' => $cacheKey,
                'temp_zip_path' => $tempZipPath,
                'compressed_size' => $fileSize,
                'memory_used' => $memoryPeak - $memoryBefore,
                'memory_peak' => $memoryPeak,
            ]);

            return $tempZipPath;
        } catch (Throwable $e) {
            // Clean up resources
            $zip->close();
            if (file_exists($tempZipPath)) {
                unlink($tempZipPath);
            }
            $this->logger->error('ZipArchive compression failed', [
                'cache_key' => $cacheKey,
                'temp_zip_path' => $tempZipPath,
                'error' => $e->getMessage(),
                'processed_count' => $processedCount,
                'memory_used' => memory_get_usage(true) - $memoryBefore,
            ]);
            throw $e;
        }
    }

    /**
     * Add file to ZIP archive using ZipArchive.
     */
    private function addFileToZipArchive(ZipArchive $zip, string $fileId, array $linkData, string $cacheKey, string $organizationCode, string $workdir): void
    {
        // Get original file name and related information
        $originalFileName = $linkData['file_name'] ?? '';
        $downloadName = $linkData['download_name'] ?? '';
        $filePath = $linkData['path'] ?? '';
        $fileUrl = $linkData['url'];

        // Generate ZIP entry name with folder structure support
        $zipEntryName = $this->generateZipRelativePath($workdir, $filePath);

        try {
            $this->logger->debug('Starting file processing', [
                'cache_key' => $cacheKey,
                'file_id' => $fileId,
                'original_file_name' => $originalFileName,
                'zip_entry_name' => $zipEntryName,
                'utf8_check' => mb_check_encoding($zipEntryName, 'UTF-8'),
            ]);

            // Download file content
            $fileContent = $this->downloadFileContent($fileUrl, $organizationCode, $filePath);

            if ($fileContent === false) {
                $this->logger->warning('File download failed, skipping', [
                    'cache_key' => $cacheKey,
                    'file_id' => $fileId,
                    'file_url' => $fileUrl,
                    'file_path' => $filePath,
                ]);
                return;
            }

            // Add file content to ZIP with UTF-8 filename (standard encoding)
            $zip->addFromString($zipEntryName, $fileContent);

            // Set UTF-8 comment for this file
            $zip->setCommentName($zipEntryName, 'UTF-8编码文件');

            $this->logger->debug('File successfully added to ZIP archive', [
                'cache_key' => $cacheKey,
                'file_id' => $fileId,
                'zip_entry_name' => $zipEntryName,
                'content_size' => strlen($fileContent),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to add file to ZIP archive', [
                'cache_key' => $cacheKey,
                'file_id' => $fileId,
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);
            // Single file failure does not interrupt the entire batch
        }
    }

    /**
     * Generate relative path within ZIP based on workdir and file_key.
     *
     * @param string $workdir Working directory path
     * @param string $fileKey Complete storage path of the file
     * @return string Relative path within ZIP
     */
    private function generateZipRelativePath(string $workdir, string $fileKey): string
    {
        // 1. Normalize path separators and clean whitespace
        $fileKey = str_replace(['\\', '//', '///'], '/', trim($fileKey));
        $workdir = str_replace(['\\', '//', '///'], '/', trim($workdir, '/'));

        // 2. Special case: if workdir is empty, return entire fileKey
        if (empty($workdir)) {
            return trim($fileKey, '/');
        }

        // 3. Find position of workdir in file_key
        $workdirPos = strpos($fileKey, $workdir);

        if ($workdirPos !== false) {
            // 4. Extract part after workdir
            $startPos = $workdirPos + strlen($workdir);
            $relativePath = ltrim(substr($fileKey, $startPos), '/');

            if (! empty($relativePath)) {
                // 5. Clean path for security
                return $this->sanitizeZipPath($relativePath);
            }
            // workdir matches but no subsequent path, return file name
            return basename($fileKey);
        }

        // 6. Fallback handling: workdir match failed
        return $this->fallbackPathGeneration($fileKey);
    }

    /**
     * Clean ZIP path to ensure security.
     */
    private function sanitizeZipPath(string $path): string
    {
        // 1. Remove dangerous characters
        $path = preg_replace('/[<>:"|?*]/', '_', $path);

        // 2. Prevent path traversal attacks
        $path = str_replace(['../', '..\\', '../\\'], '', $path);

        // 3. Clean consecutive slashes
        $path = preg_replace('/\/+/', '/', $path);

        // 4. Limit path depth (prevent overly deep nesting)
        $parts = explode('/', trim($path, '/'));
        if (count($parts) > 8) {  // Maximum 8 levels deep
            $parts = array_slice($parts, -8);  // Keep last 8 levels
        }

        return implode('/', array_filter($parts));
    }

    /**
     * Fallback path generation strategy.
     */
    private function fallbackPathGeneration(string $fileKey): string
    {
        // Strategy 1: Use the last two levels of the file path
        $pathParts = array_filter(explode('/', $fileKey));
        $count = count($pathParts);

        if ($count >= 2) {
            // Take the last two levels: second-to-last as folder, last as file name
            $folder = $pathParts[$count - 2];
            $file = $pathParts[$count - 1];

            return $folder . '/' . $file;
        }

        // Strategy 2: Use the last level directly (file name)
        return $count > 0 ? $pathParts[$count - 1] : 'unknown_file';
    }

    /**
     * Upload compressed file to storage.
     */
    private function uploadCompressedFile(string $organizationCode, string $tempZipPath, string $zipFileName, string $uploadPath): array
    {
        try {
            // Check if file exists
            if (! file_exists($tempZipPath)) {
                throw new RuntimeException("Temporary ZIP file does not exist: {$tempZipPath}");
            }

            $fileSize = filesize($tempZipPath);

            // Ensure file name has correct extension
            if (! str_ends_with(strtolower($zipFileName), '.zip')) {
                $zipFileName .= '.zip';
            }

            // Clean and normalize upload path
            $uploadFileKey = trim($uploadPath, '/') . '/' . ltrim($zipFileName, '/');

            $this->logger->info('Preparing to upload compressed file', [
                'original_zip_name' => $zipFileName,
                'upload_path' => $uploadFileKey,
                'file_size' => $fileSize,
                'temp_zip_path' => $tempZipPath,
            ]);

            // Use chunked upload (internally determines if chunking is needed)
            $chunkConfig = new ChunkUploadConfig(
                10 * 1024 * 1024,  // 10MB chunk size
                20 * 1024 * 1024,  // 20MB threshold
                3,                 // 3 concurrent uploads
                3,                 // 3 retries
                1000               // 1s retry delay
            );

            $chunkUploadFile = new ChunkUploadFile(
                $tempZipPath,
                '',
                $uploadFileKey,
                false,
                $chunkConfig
            );

            $this->logger->info('Starting compressed file upload', [
                'file_size_mb' => round($fileSize / 1024 / 1024, 2),
                'chunk_size_mb' => round($chunkConfig->getChunkSize() / 1024 / 1024, 2),
                'upload_file_key' => $uploadFileKey,
                'will_use_chunks' => $chunkUploadFile->shouldUseChunkUpload(),
            ]);

            // Execute upload (internally determines whether to use chunked or regular upload)
            $this->fileDomainService->uploadByChunks($organizationCode, $chunkUploadFile, $this->storageBucketType, false);

            $this->logger->info('Compressed file upload successful', [
                'file_key' => $chunkUploadFile->getKey(),
                'file_name' => $zipFileName,
                'upload_path' => $uploadPath,
                'file_size' => $fileSize,
                'upload_id' => $chunkUploadFile->getUploadId(),
                'used_chunks' => $chunkUploadFile->shouldUseChunkUpload(),
            ]);

            // Register file cleanup: automatically delete after 2 hours
            $this->registerFileForCleanup(
                $organizationCode,
                $chunkUploadFile->getKey(),
                $zipFileName,
                $fileSize
            );

            return [
                'success' => true,
                'file_key' => $chunkUploadFile->getKey(),
                'file_name' => $zipFileName,
                'upload_path' => $uploadPath,
                'file_size' => $fileSize,
            ];
        } catch (Throwable $exception) {
            $this->logger->error('Compressed file upload failed', [
                'error' => $exception->getMessage(),
                'file_name' => $zipFileName,
                'upload_path' => $uploadPath,
                'temp_zip_path' => $tempZipPath,
            ]);

            return [
                'success' => false,
                'error' => $exception->getMessage(),
            ];
        }
    }

    /**
     * Generate download link for compressed file.
     */
    private function generateDownloadLink(string $organizationCode, string $fileKey, array $downloadNames = []): ?FileLink
    {
        try {
            return $this->fileDomainService->getLink($organizationCode, $fileKey, $this->storageBucketType, $downloadNames);
        } catch (Throwable $e) {
            $this->logger->error('Failed to generate download link', [
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Register file for cleanup.
     */
    private function registerFileForCleanup(
        string $organizationCode,
        string $fileKey,
        string $fileName,
        int $fileSize
    ): void {
        try {
            $success = $this->fileCleanupDomainService->registerFileForCleanup(
                organizationCode: $organizationCode,
                fileKey: $fileKey,
                fileName: $fileName,
                fileSize: $fileSize,
                sourceType: 'batch_compress',
                sourceId: null,
                expireAfterSeconds: 7200, // Expires after 2 hours
                bucketType: 'private'
            );

            if ($success) {
                $this->logger->info('File cleanup registration successful', [
                    'file_key' => $fileKey,
                    'file_name' => $fileName,
                    'organization_code' => $organizationCode,
                ]);
            } else {
                $this->logger->warning('File cleanup registration failed', [
                    'file_key' => $fileKey,
                    'file_name' => $fileName,
                    'organization_code' => $organizationCode,
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('File cleanup registration exception', [
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Download file content from URL.
     */
    private function downloadFileContent(string $fileUrl, string $organizationCode, string $filePath)
    {
        try {
            // Try to use downloadByChunks first for large files
            $tempPath = $this->baseTempDir . '/download_' . uniqid();
            $this->registerTempFile($tempPath);

            $chunksDir = $this->createTempDirectory($this->getCurrentCacheKey(), 'download_chunks');
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $filePath,
                $tempPath,
                $this->storageBucketType,
                [
                    'chunk_size' => 2 * 1024 * 1024,  // 2MB chunks
                    'max_concurrency' => 3,
                    'max_retries' => 3,
                    'temp_dir' => $chunksDir,
                ]
            );

            if (file_exists($tempPath)) {
                $content = file_get_contents($tempPath);
                unlink($tempPath); // Clean up immediately
                return $content;
            }
        } catch (Throwable $e) {
            $this->logger->warning('downloadByChunks failed, trying direct download', [
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);
        }

        // Fallback to direct download
        return $this->downloadFileContentDirect($fileUrl);
    }

    /**
     * Download file content directly from URL.
     */
    private function downloadFileContentDirect(string $fileUrl)
    {
        try {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 30,
                    'user_agent' => 'FileBatchCompress/1.0',
                    'follow_location' => true,
                    'max_redirects' => 3,
                ],
            ]);

            return file_get_contents($fileUrl, false, $context);
        } catch (Throwable $e) {
            $this->logger->error('Direct file download failed', [
                'file_url' => $fileUrl,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}
