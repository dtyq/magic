<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\Video;

use App\Domain\Design\Factory\PathFactory;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use RuntimeException;

/**
 * 负责从工作区参考视频读取真实媒体时长，供视频积分预估使用。
 */
readonly class VideoInputMediaMetadataResolver
{
    private const string TEMP_FILE_PREFIX = 'video-estimate-';

    /**
     * 注入文件服务和媒体探测器，用于读取工作区视频真实时长。
     */
    public function __construct(
        private FileDomainService $fileDomainService,
        private VideoMediaProbeInterface $videoMediaProbe,
    ) {
    }

    /**
     * 预估计费必须读取真实参考视频时长，不能信任客户端透传的秒数。
     *
     * @param list<array<string, mixed>> $referenceVideos
     * @return array{total_duration_seconds: int, reference_video_count: int}
     */
    public function resolve(
        ModelGatewayDataIsolation $dataIsolation,
        int $projectId,
        array $referenceVideos
    ): array {
        if ($referenceVideos === []) {
            return [
                'total_duration_seconds' => 0,
                'reference_video_count' => 0,
            ];
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $workspacePrefix = PathFactory::getWorkspacePrefix(
            $this->fileDomainService->getFullPrefix($organizationCode),
            $projectId
        );
        $totalDurationSeconds = 0;
        $referenceVideoCount = 0;

        foreach ($referenceVideos as $referenceVideo) {
            $relativePath = $this->normalizeRelativePath($referenceVideo['uri'] ?? null);
            if ($relativePath === null) {
                continue;
            }

            $metadata = $this->probeWorkspaceVideo($organizationCode, $workspacePrefix . $relativePath);
            $totalDurationSeconds += $this->roundDurationSeconds($metadata->getDurationSecondsFloat());
            ++$referenceVideoCount;
        }

        return [
            'total_duration_seconds' => $totalDurationSeconds,
            'reference_video_count' => $referenceVideoCount,
        ];
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
     * 统一参考视频路径为工作区相对路径，并拒绝外部 URL。
     */
    private function normalizeRelativePath(mixed $value): ?string
    {
        $uri = is_string($value) ? trim($value) : '';
        if ($uri === '') {
            return null;
        }
        if (str_contains($uri, '://')) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.reference_videos must be workspace file path');
        }

        return '/' . ltrim($uri, '/');
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
