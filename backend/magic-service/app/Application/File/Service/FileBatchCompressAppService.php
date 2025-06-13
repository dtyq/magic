<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Service;

use App\Domain\File\Constant\FileBatchConstant;
use App\Domain\File\Event\FileBatchCompressEvent;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;
use ZipStream\CompressionMethod;
use ZipStream\ZipStream;

/**
 * File batch compression application service.
 */
class FileBatchCompressAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FileAppService $fileAppService,
        private readonly FileDomainService $fileDomainService,
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
        return $this->processBatchCompress(
            $event->getCacheKey(),
            $event->getOrganizationCode(),
            $event->getFiles(),
            $event->getWorkdir(),
            $event->getTargetName(),
            $event->getTargetPath()
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
        }
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
            $links = $this->fileDomainService->getLinks($organizationCode, $fileKeys, StorageBucketType::Private);

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

            // Step 3: Generate download link
            $downloadLink = $this->generateDownloadLink($organizationCode, $uploadResult['file_key']);

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
            // 清理临时ZIP文件
            if ($tempZipPath && file_exists($tempZipPath)) {
                unlink($tempZipPath);
                $this->logger->debug('Cleaned up temporary ZIP file', [
                    'temp_zip_path' => $tempZipPath,
                ]);
            }
        }
    }

    /**
     * Stream compress files using ZipStream-PHP.
     */
    private function streamCompressFiles(string $cacheKey, string $organizationCode, array $fileLinks, string $workdir): string
    {
        $this->logger->info('开始流式压缩文件批次', ['cache_key' => $cacheKey, 'file_count' => count($fileLinks)]);

        // 创建临时ZIP文件
        $tempZipPath = tempnam(sys_get_temp_dir(), 'batch_compress_') . '.zip';
        $outputStream = fopen($tempZipPath, 'w+b');

        if (! $outputStream) {
            throw new RuntimeException("无法创建临时ZIP文件: {$tempZipPath}");
        }

        // 配置 ZipStream 直接写入文件
        $zip = new ZipStream(
            outputStream: $outputStream,
            defaultCompressionMethod: CompressionMethod::DEFLATE,
            defaultDeflateLevel: 6,
            enableZip64: true,
            sendHttpHeaders: false
        );

        $processedCount = 0;
        $totalFiles = count($fileLinks);
        $memoryBefore = memory_get_usage(true);

        try {
            foreach ($fileLinks as $fileId => $linkData) {
                $this->addFileToZipStream($zip, (string) $fileId, $linkData, $cacheKey, $organizationCode, $workdir);
                ++$processedCount;

                // 更新进度
                $progress = round(($processedCount / $totalFiles) * 100, 2);
                $this->statusManager->setTaskProgress($cacheKey, $processedCount, $totalFiles, "Processing file {$processedCount}/{$totalFiles}");

                $this->logger->debug('文件添加到ZIP流', [
                    'cache_key' => $cacheKey,
                    'file_id' => $fileId,
                    'progress' => $progress,
                    'memory_usage' => memory_get_usage(true) - $memoryBefore,
                ]);
            }

            // 完成压缩
            $zip->finish();
            fclose($outputStream);

            $memoryPeak = memory_get_peak_usage(true);
            $fileSize = file_exists($tempZipPath) ? filesize($tempZipPath) : 0;

            $this->logger->info('流式压缩完成', [
                'cache_key' => $cacheKey,
                'temp_zip_path' => $tempZipPath,
                'compressed_size' => $fileSize,
                'memory_used' => $memoryPeak - $memoryBefore,
                'memory_peak' => $memoryPeak,
            ]);

            return $tempZipPath;
        } catch (Throwable $e) {
            // 清理资源
            if (is_resource($outputStream)) {
                fclose($outputStream);
            }
            if (file_exists($tempZipPath)) {
                unlink($tempZipPath);
            }

            $this->logger->error('流式压缩失败', [
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
     * 添加文件到ZIP流
     */
    private function addFileToZipStream(ZipStream $zip, string $fileId, array $linkData, string $cacheKey, string $organizationCode, string $workdir): void
    {
        // 获取原始文件名和相关信息
        $originalFileName = $linkData['file_name'] ?? '';
        $downloadName = $linkData['download_name'] ?? '';
        $filePath = $linkData['path'] ?? '';
        $fileUrl = $linkData['url'];

        // 🔄 NEW: 使用新的ZIP路径生成方法，支持文件夹结构
        $zipEntryName = $this->generateZipRelativePath($workdir, $filePath);

        try {
            $this->logger->debug('开始处理文件', [
                'cache_key' => $cacheKey,
                'file_id' => $fileId,
                'original_file_name' => $originalFileName,
                'download_name' => $downloadName,
                'file_path' => $filePath,
                'zip_entry_name' => $zipEntryName,
                'workdir' => $workdir,
            ]);

            // 使用流式下载获取文件内容
            $fileStream = $this->downloadFileAsStream($fileUrl, $organizationCode, $filePath);

            if (! $fileStream) {
                $this->logger->warning('文件下载失败，跳过', [
                    'cache_key' => $cacheKey,
                    'file_id' => $fileId,
                    'file_url' => $fileUrl,
                    'file_path' => $filePath,
                ]);
                return;
            }

            // 直接从流添加到ZIP（真正的流式处理）
            $zip->addFileFromStream(
                fileName: $zipEntryName,
                stream: $fileStream
            );

            // 关闭流并清理临时文件
            $this->closeStreamAndCleanup($fileStream);

            $this->logger->debug('文件成功添加到ZIP', [
                'cache_key' => $cacheKey,
                'file_id' => $fileId,
                'original_name' => $originalFileName,
                'file_path' => $filePath,
                'zip_entry_name' => $zipEntryName,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('添加文件到ZIP流失败', [
                'cache_key' => $cacheKey,
                'file_id' => $fileId,
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);
            // 单个文件失败不中断整个批次
        }
    }

    /**
     * 根据workdir和file_key生成ZIP内的相对路径.
     *
     * @param string $workdir 工作目录路径
     * @param string $fileKey 文件的完整存储路径
     * @return string ZIP内的相对路径
     */
    private function generateZipRelativePath(string $workdir, string $fileKey): string
    {
        // 1. 标准化路径分隔符和清理空白
        $fileKey = str_replace(['\\', '//', '///'], '/', trim($fileKey));
        $workdir = str_replace(['\\', '//', '///'], '/', trim($workdir, '/'));

        // 2. 特殊情况：workdir为空，返回整个fileKey
        if (empty($workdir)) {
            return trim($fileKey, '/');
        }

        // 3. 在file_key中查找workdir的位置
        $workdirPos = strpos($fileKey, $workdir);

        if ($workdirPos !== false) {
            // 4. 提取workdir之后的部分
            $startPos = $workdirPos + strlen($workdir);
            $relativePath = ltrim(substr($fileKey, $startPos), '/');

            if (! empty($relativePath)) {
                // 5. 清理路径安全性
                return $this->sanitizeZipPath($relativePath);
            }
            // workdir匹配但没有后续路径，返回文件名
            return basename($fileKey);
        }

        // 6. 降级处理：workdir匹配失败
        return $this->fallbackPathGeneration($fileKey);
    }

    /**
     * 清理ZIP路径，确保安全性.
     */
    private function sanitizeZipPath(string $path): string
    {
        // 1. 移除危险字符
        $path = preg_replace('/[<>:"|?*]/', '_', $path);

        // 2. 防止路径遍历攻击
        $path = str_replace(['../', '..\\', '../\\'], '', $path);

        // 3. 清理连续的斜杠
        $path = preg_replace('/\/+/', '/', $path);

        // 4. 限制路径深度（防止过深的嵌套）
        $parts = explode('/', trim($path, '/'));
        if (count($parts) > 8) {  // 最大8层深度
            $parts = array_slice($parts, -8);  // 保留最后8层
        }

        return implode('/', array_filter($parts));
    }

    /**
     * 降级路径生成策略.
     */
    private function fallbackPathGeneration(string $fileKey): string
    {
        // 策略1: 使用文件路径的最后两级目录
        $pathParts = array_filter(explode('/', $fileKey));
        $count = count($pathParts);

        if ($count >= 2) {
            // 取最后两级：倒数第二级作为文件夹，最后一级作为文件名
            $folder = $pathParts[$count - 2];
            $file = $pathParts[$count - 1];

            return $folder . '/' . $file;
        }

        // 策略2: 直接使用最后一级（文件名）
        return $count > 0 ? $pathParts[$count - 1] : 'unknown_file';
    }

    /**
     * 流式下载文件 - 使用downloadByChunks自动判断是否分片.
     */
    private function downloadFileAsStream(string $fileUrl, string $organizationCode, string $filePath)
    {
        try {
            // 生成临时文件路径
            $tempPath = sys_get_temp_dir() . '/' . uniqid('batch_compress_', true) . '_' . basename($filePath);

            // 使用downloadByChunks，它会自动判断是否需要分片下载
            $this->fileAppService->downloadByChunks(
                $organizationCode,
                $filePath,
                $tempPath,
                'private',
                [
                    'chunk_size' => 2 * 1024 * 1024,  // 2MB分片
                    'max_concurrency' => 3,           // 3个并发
                    'max_retries' => 3,               // 最多重试3次
                ]
            );

            // 检查文件是否下载成功
            if (! file_exists($tempPath)) {
                $this->logger->error('文件下载失败，文件不存在', [
                    'temp_path' => $tempPath,
                    'file_path' => $filePath,
                ]);
                return $this->fallbackStreamDownload($fileUrl);
            }

            // 将下载的文件转换为流
            $fileStream = fopen($tempPath, 'r');
            if (! $fileStream) {
                $this->logger->error('无法打开下载的文件', [
                    'temp_path' => $tempPath,
                ]);
                // 清理失败的临时文件
                // @phpstan-ignore-next-line (defensive programming - double check before cleanup)
                if (file_exists($tempPath)) {
                    unlink($tempPath);
                }
                return $this->fallbackStreamDownload($fileUrl);
            }

            // 注册清理函数，在流关闭时删除临时文件
            $this->registerStreamCleanup($fileStream, $tempPath);

            return $fileStream;
        } catch (Throwable $e) {
            $this->logger->error('downloadByChunks下载失败', [
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);

            // 降级到直接流式下载
            return $this->fallbackStreamDownload($fileUrl);
        }
    }

    /**
     * 降级方案：直接流式下载.
     */
    private function fallbackStreamDownload(string $fileUrl)
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

            $stream = fopen($fileUrl, 'r', false, $context);

            if (! $stream) {
                $this->logger->error('直接流式下载也失败', [
                    'file_url' => $fileUrl,
                ]);
                return null;
            }

            return $stream;
        } catch (Throwable $e) {
            $this->logger->error('降级下载失败', [
                'file_url' => $fileUrl,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 注册流清理函数.
     * @param mixed $stream
     */
    private function registerStreamCleanup($stream, string $tempFilePath): void
    {
        // 使用stream_context_set_option来存储清理信息
        // 这样在流关闭时可以清理临时文件
        stream_context_set_option($stream, 'cleanup', 'temp_file', $tempFilePath);
    }

    /**
     * 关闭流并清理临时文件.
     * @param mixed $stream
     */
    private function closeStreamAndCleanup($stream): void
    {
        if (! $stream) {
            return;
        }

        try {
            // 尝试获取清理信息
            $context = stream_context_get_options($stream);
            $tempFile = $context['cleanup']['temp_file'] ?? null;

            // 关闭流
            fclose($stream);

            // 清理临时文件
            if ($tempFile && file_exists($tempFile)) {
                unlink($tempFile);
                $this->logger->debug('清理临时文件', ['temp_file' => $tempFile]);
            }
        } catch (Throwable $e) {
            $this->logger->warning('清理流和临时文件时出错', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Upload compressed file to storage.
     */
    private function uploadCompressedFile(string $organizationCode, string $tempZipPath, string $zipFileName, string $uploadPath): array
    {
        try {
            // 检查文件是否存在
            if (! file_exists($tempZipPath)) {
                throw new RuntimeException("临时ZIP文件不存在: {$tempZipPath}");
            }

            $fileSize = filesize($tempZipPath);

            // 确保文件名有正确的扩展名
            if (! str_ends_with(strtolower($zipFileName), '.zip')) {
                $zipFileName .= '.zip';
            }

            // 清理和标准化上传路径
            $uploadFileKey = trim($uploadPath, '/') . '/' . ltrim($zipFileName, '/');

            $this->logger->info('准备上传压缩文件', [
                'original_zip_name' => $zipFileName,
                'upload_path' => $uploadFileKey,
                'file_size' => $fileSize,
                'temp_zip_path' => $tempZipPath,
            ]);

            // 使用分片上传（内部会自动判断是否需要分片）
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

            $this->logger->info('开始上传压缩文件', [
                'file_size_mb' => round($fileSize / 1024 / 1024, 2),
                'chunk_size_mb' => round($chunkConfig->getChunkSize() / 1024 / 1024, 2),
                'upload_file_key' => $uploadFileKey,
                'will_use_chunks' => $chunkUploadFile->shouldUseChunkUpload(),
            ]);

            // 执行上传（内部会自动判断使用分片还是普通上传）
            $this->fileDomainService->uploadByChunks($organizationCode, $chunkUploadFile, StorageBucketType::Private, false);

            $this->logger->info('压缩文件上传成功', [
                'file_key' => $chunkUploadFile->getKey(),
                'file_name' => $zipFileName,
                'upload_path' => $uploadPath,
                'file_size' => $fileSize,
                'upload_id' => $chunkUploadFile->getUploadId(),
                'used_chunks' => $chunkUploadFile->shouldUseChunkUpload(),
            ]);

            return [
                'success' => true,
                'file_key' => $chunkUploadFile->getKey(),
                'file_name' => $zipFileName,
                'upload_path' => $uploadPath,
                'file_size' => $fileSize,
            ];
        } catch (Throwable $exception) {
            $this->logger->error('压缩文件上传失败', [
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
    private function generateDownloadLink(string $organizationCode, string $fileKey): ?FileLink
    {
        try {
            return $this->fileDomainService->getLink($organizationCode, $fileKey, StorageBucketType::Private);
        } catch (Throwable $e) {
            $this->logger->error('Failed to generate download link', [
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
