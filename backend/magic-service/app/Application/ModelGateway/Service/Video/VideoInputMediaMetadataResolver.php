<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\Video;

use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;

/**
 * 负责读取参考视频真实媒体时长。
 */
readonly class VideoInputMediaMetadataResolver
{
    private const string TEMP_FILE_PREFIX = 'video-estimate-';

    private const int PROBE_DOWNLOAD_MAX_BYTES = 104857600;

    private const int STREAM_BUFFER_BYTES = 8192;

    private const int CACHE_TTL_SECONDS = 86400;

    private const string CACHE_KEY_PREFIX = 'video_input_metadata:v1';

    /**
     * 注入文件服务和媒体探测器，用于读取工作区或外部 URL 视频真实时长。
     */
    public function __construct(
        private TaskFileDomainService $taskFileDomainService,
        private FileDomainService $fileDomainService,
        private VideoMediaProbeInterface $videoMediaProbe,
        private CacheInterface $cache,
    ) {
    }

    /**
     * 预估计费必须读取真实参考视频时长，不能信任客户端透传的秒数。
     * 工作区文件沿用现有 TaskFile 缓存；外部 URL 则实时下载并探测最新元数据。
     *
     * @param list<array<string, mixed>> $referenceVideos
     * @param bool $forceRecheck 为 true 时跳过缓存并重新探测，当前只预留给底层内部调用
     * @return array{total_duration_seconds: int, reference_video_count: int}
     */
    public function resolve(
        ModelGatewayDataIsolation $dataIsolation,
        ?int $projectId,
        array $referenceVideos,
        bool $forceRecheck = false,
    ): array {
        if ($referenceVideos === []) {
            return [
                'total_duration_seconds' => 0,
                'reference_video_count' => 0,
            ];
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $totalDurationSeconds = 0;
        $referenceVideoCount = 0;
        $normalizedReferencePaths = [];
        $remoteUrls = [];

        foreach ($referenceVideos as $referenceVideo) {
            $uri = $this->normalizeReferenceUri($referenceVideo['uri'] ?? null);
            if ($uri === null) {
                continue;
            }

            // 外部 URL 直接实时探测；工作区路径继续走 TaskFile + 缓存链路。
            if ($this->isRemoteUrl($uri)) {
                $remoteUrls[] = $uri;
                continue;
            }

            $normalizedReferencePaths[] = $this->normalizeRelativePath($uri);
        }

        if ($normalizedReferencePaths === [] && $remoteUrls === []) {
            return [
                'total_duration_seconds' => 0,
                'reference_video_count' => 0,
            ];
        }

        foreach ($remoteUrls as $remoteUrl) {
            $metadata = $this->probeRemoteVideo($remoteUrl);
            $totalDurationSeconds += $this->roundDurationSeconds($metadata->getDurationSecondsFloat());
            ++$referenceVideoCount;
        }

        if ($normalizedReferencePaths !== []) {
            if ($projectId === null) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'project_id is required for workspace reference videos');
            }

            $taskFilesByRelativePath = $this->resolveWorkspaceTaskFiles(
                $projectId,
                array_values(array_unique($normalizedReferencePaths))
            );

            foreach ($normalizedReferencePaths as $relativePath) {
                $taskFile = $taskFilesByRelativePath[$relativePath];
                $metadata = $this->resolveWorkspaceVideoMetadata($organizationCode, $projectId, $taskFile, $forceRecheck);
                $totalDurationSeconds += $this->roundDurationSeconds($metadata->getDurationSecondsFloat());
                ++$referenceVideoCount;
            }
        }

        return [
            'total_duration_seconds' => $totalDurationSeconds,
            'reference_video_count' => $referenceVideoCount,
        ];
    }

    /**
     * 参考视频缓存 24 小时；默认按项目内 file_id + 文件元数据指纹复用探测结果。
     *
     * 缓存键绑定 project_id、file_id、file_size、updated_at，
     * 这样同一文件被覆盖或更新后会自然失效，不会继续复用旧探测结果。
     */
    private function resolveWorkspaceVideoMetadata(
        string $organizationCode,
        int $projectId,
        TaskFileEntity $taskFile,
        bool $forceRecheck
    ): VideoMediaMetadata {
        $cacheKey = $this->buildCacheKey($projectId, $taskFile);
        if (! $forceRecheck) {
            $cached = $this->restoreCachedMetadata($this->cache->get($cacheKey));
            if ($cached !== null) {
                return $cached;
            }
        }

        $metadata = $this->probeWorkspaceVideo($organizationCode, $taskFile->getFileKey());
        $this->cache->set($cacheKey, [
            'duration_seconds' => $metadata->getDurationSecondsFloat(),
            'width' => $metadata->getWidth(),
            'height' => $metadata->getHeight(),
        ], self::CACHE_TTL_SECONDS);

        return $metadata;
    }

    /**
     * 从沙箱存储下载工作区视频到临时文件，并用 ffprobe 读取真实媒体信息。
     */
    private function probeWorkspaceVideo(string $organizationCode, string $fullPath): VideoMediaMetadata
    {
        $tempPath = tempnam(sys_get_temp_dir(), self::TEMP_FILE_PREFIX);
        if ($tempPath === false) {
            throw new RuntimeException('create temp file failed');
        }

        try {
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $fullPath,
                $tempPath,
                StorageBucketType::SandBox
            );

            return $this->videoMediaProbe->probe($tempPath);
        } finally {
            if (is_file($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    /**
     * 外部 URL 不参与工作区缓存，始终下载后实时探测最新媒体元数据。
     */
    private function probeRemoteVideo(string $url): VideoMediaMetadata
    {
        $tempPath = tempnam(sys_get_temp_dir(), self::TEMP_FILE_PREFIX);
        if ($tempPath === false) {
            throw new RuntimeException('create temp file failed');
        }

        try {
            $this->downloadRemoteVideoToTempFile($url, $tempPath);
            return $this->videoMediaProbe->probe($tempPath);
        } finally {
            if (is_file($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    /**
     * 基于项目根目录 file_key 把工作区相对路径解析成 TaskFileEntity。
     *
     * @param string[] $relativePaths
     * @return array<string, TaskFileEntity>
     */
    private function resolveWorkspaceTaskFiles(int $projectId, array $relativePaths): array
    {
        // 先拿项目根目录，再把相对路径拼成完整 file_key，复用现有公开查询接口。
        $rootFile = $this->taskFileDomainService->getRootFile($projectId);
        if (! $rootFile || ! $rootFile->getIsDirectory()) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.reference_videos file not found');
        }

        $taskFilesByRelativePath = [];

        foreach ($relativePaths as $relativePath) {
            $fullFileKey = $this->buildWorkspaceFileKey($rootFile, $relativePath);
            $taskFile = $this->taskFileDomainService->getByProjectIdAndFileKey($projectId, $fullFileKey);
            if (! $taskFile || $taskFile->getIsDirectory()) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.reference_videos file not found');
            }

            $taskFilesByRelativePath[$relativePath] = $taskFile;
        }

        return $taskFilesByRelativePath;
    }

    /**
     * 统一参考视频 URI 的空值/空白处理，真正的 URL/工作区分流交给调用方。
     */
    private function normalizeReferenceUri(mixed $value): ?string
    {
        $uri = is_string($value) ? trim($value) : '';
        if ($uri === '') {
            return null;
        }

        return $uri;
    }

    /**
     * 统一参考视频路径为工作区相对路径，并拒绝非 http/https 的外部 URI。
     */
    private function normalizeRelativePath(string $uri): string
    {
        if (str_contains($uri, '://')) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.reference_videos must be workspace file path');
        }

        $normalizedPath = preg_replace('#^\./#', '', ltrim($uri, '/'));
        $normalizedPath = preg_replace('#/+#', '/', (string) $normalizedPath);
        $normalizedPath = rtrim((string) $normalizedPath, '/');

        return '/' . ltrim((string) $normalizedPath, '/');
    }

    private function isRemoteUrl(string $uri): bool
    {
        $scheme = strtolower((string) parse_url($uri, PHP_URL_SCHEME));

        return in_array($scheme, ['http', 'https'], true);
    }

    private function downloadRemoteVideoToTempFile(string $url, string $tempPath): void
    {
        // 远程 URL 仍保留 SSRF 安全校验，但不做缓存，保持每次读取最新媒体元数据。
        $safeUrl = SSRFUtil::getSafeUrl($url, replaceIp: false, allowRedirect: true);
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
        $remoteStream = fopen($safeUrl, 'rb', false, $context);
        $localStream = fopen($tempPath, 'wb');
        if (! is_resource($remoteStream) || ! is_resource($localStream)) {
            if (is_resource($remoteStream)) {
                fclose($remoteStream);
            }
            if (is_resource($localStream)) {
                fclose($localStream);
            }
            throw new RuntimeException('open video probe stream failed');
        }

        try {
            $downloadedBytes = 0;
            while (! feof($remoteStream)) {
                $buffer = fread($remoteStream, self::STREAM_BUFFER_BYTES);
                if ($buffer === false) {
                    throw new RuntimeException('read video probe stream failed');
                }
                if ($buffer === '') {
                    continue;
                }

                $downloadedBytes += strlen($buffer);
                if ($downloadedBytes > self::PROBE_DOWNLOAD_MAX_BYTES) {
                    throw new RuntimeException('video probe file exceeds max size');
                }

                if (fwrite($localStream, $buffer) === false) {
                    throw new RuntimeException('write video probe temp file failed');
                }
            }
        } finally {
            fclose($remoteStream);
            fclose($localStream);
        }
    }

    private function buildWorkspaceFileKey(TaskFileEntity $rootFile, string $relativePath): string
    {
        // TaskFile 公开查询接口按完整 file_key 检索，这里统一把工作区相对路径补齐到根目录之下。
        return (string) preg_replace(
            '#/+#',
            '/',
            rtrim($rootFile->getFileKey(), '/') . '/' . ltrim($relativePath, '/')
        );
    }

    /**
     * 用项目维度和文件元数据构造缓存键，避免不同项目同 file_id 或同名文件互相污染。
     */
    private function buildCacheKey(int $projectId, TaskFileEntity $taskFile): string
    {
        return implode(':', [
            self::CACHE_KEY_PREFIX,
            $projectId,
            $taskFile->getFileId(),
            $taskFile->getFileSize(),
            $this->normalizeUpdatedAt($taskFile->getUpdatedAt()),
        ]);
    }

    /**
     * 把文件更新时间归一化成时间戳，便于稳定参与缓存键拼接。
     */
    private function normalizeUpdatedAt(string $updatedAt): int
    {
        $timestamp = strtotime($updatedAt);
        return $timestamp === false ? 0 : $timestamp;
    }

    /**
     * 只接受结构完整且值合法的缓存内容，脏缓存或旧格式一律按未命中处理。
     */
    private function restoreCachedMetadata(mixed $cached): ?VideoMediaMetadata
    {
        if (! is_array($cached)) {
            return null;
        }

        $durationSeconds = $cached['duration_seconds'] ?? null;
        $width = $cached['width'] ?? null;
        $height = $cached['height'] ?? null;

        if (is_string($durationSeconds) && is_numeric($durationSeconds)) {
            $durationSeconds = (float) $durationSeconds;
        }
        if (is_string($width) && is_numeric($width)) {
            $width = (int) $width;
        }
        if (is_string($height) && is_numeric($height)) {
            $height = (int) $height;
        }

        if ((! is_float($durationSeconds) && ! is_int($durationSeconds)) || ! is_int($width) || ! is_int($height)) {
            return null;
        }
        if ((float) $durationSeconds <= 0 || $width <= 0 || $height <= 0) {
            return null;
        }

        return new VideoMediaMetadata((float) $durationSeconds, $width, $height);
    }

    /**
     * 将探测到的视频时长折算成计费秒数，接近整数时避免浮点误差多算一秒。
     */
    private function roundDurationSeconds(float $durationSeconds): int
    {
        $rounded = round($durationSeconds);
        if (abs($durationSeconds - $rounded) <= 0.1) {
            return max(1, (int) $rounded);
        }

        return max(1, (int) ceil($durationSeconds));
    }
}
