<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

/**
 * 统一解析视频计费维度，避免预估、实际扣费和 provider 结果兜底各算一套。
 */
readonly class VideoBillingDetailsResolver
{
    /**
     * @var array<string, array{size: string, width: int, height: int}>
     */
    private const array BILLING_RESOLUTION_DIMENSIONS = [
        '480p' => ['size' => '854x480', 'width' => 854, 'height' => 480],
        '720p' => ['size' => '1280x720', 'width' => 1280, 'height' => 720],
        '1080p' => ['size' => '1920x1080', 'width' => 1920, 'height' => 1080],
        '2k' => ['size' => '2560x1440', 'width' => 2560, 'height' => 1440],
        '4k' => ['size' => '3840x2160', 'width' => 3840, 'height' => 2160],
    ];

    /**
     * @var array<string, string>
     */
    private const array KELING_MODE_TO_RESOLUTION = [
        'std' => '720p',
        'pro' => '1080p',
    ];

    /**
     * 从下载后的视频元数据解析实际计费维度。
     *
     * @return array{duration_seconds: int, resolution: ?string, size: string, width: int, height: int}
     */
    public function resolveFromMetadata(VideoMediaMetadata $metadata): array
    {
        $width = $metadata->getWidth();
        $height = $metadata->getHeight();

        return [
            'duration_seconds' => $this->roundDurationSeconds($metadata->getDurationSecondsFloat()),
            'resolution' => $this->mapResolutionFromDimensions($width, $height),
            'size' => sprintf('%dx%d', $width, $height),
            'width' => $width,
            'height' => $height,
        ];
    }

    /**
     * provider 结果缺少可下载视频时，从任务请求和 provider payload 里兜底解析计费维度。
     *
     * @return array{duration_seconds: int, resolution: ?string, size: ?string, width: ?int, height: ?int}
     */
    public function resolveFromFallback(VideoQueueOperationEntity $operation): array
    {
        $providerPayload = $operation->getProviderPayload();
        $dimensions = $this->resolveExplicitDimensions($operation, $providerPayload);
        $resolution = $dimensions !== null
            ? $this->resolveResolutionForDimensions($operation, $providerPayload, $dimensions['width'], $dimensions['height'])
            : $this->resolveFallbackResolution($operation, $providerPayload);

        $resolvedDimensions = $dimensions ?? $this->buildDimensionsFromResolution($resolution);

        return [
            'duration_seconds' => $this->resolveDurationSeconds($operation, $providerPayload),
            'resolution' => $resolution,
            'size' => $resolvedDimensions['size'],
            'width' => $resolvedDimensions['width'],
            'height' => $resolvedDimensions['height'],
        ];
    }

    /**
     * 根据规范化请求预解析输出视频计费维度，预估接口和实际计费共用同一套分辨率兜底。
     *
     * @return array{duration_seconds: int, resolution: ?string, size: ?string, width: ?int, height: ?int}
     */
    public function resolveFromRequest(array $request, VideoGenerationConfig $videoGenerationConfig): array
    {
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $resolution = $this->resolveResolutionCandidate([
            $generation['resolution'] ?? null,
            $this->resolveResolutionFromConfiguredSize($generation, $videoGenerationConfig),
        ]);
        $dimensions = $this->normalizeDimensions(
            $generation['width'] ?? null,
            $generation['height'] ?? null,
            $generation['size'] ?? null,
        ) ?? $this->resolveDimensionsFromConfiguredSize($generation, $resolution, $videoGenerationConfig);

        if ($dimensions !== null && $resolution === null) {
            $resolution = $this->mapResolutionFromDimensions($dimensions['width'], $dimensions['height']);
        }
        $resolvedDimensions = $dimensions ?? $this->buildDimensionsFromResolution($resolution);

        return [
            'duration_seconds' => $this->normalizePositiveInt($generation['duration_seconds'] ?? null) ?? 0,
            'resolution' => $resolution,
            'size' => $resolvedDimensions['size'],
            'width' => $resolvedDimensions['width'],
            'height' => $resolvedDimensions['height'],
        ];
    }

    /**
     * 将视频时长折算成计费秒数，接近整数时避免浮点误差多算一秒。
     */
    private function roundDurationSeconds(float $durationSeconds): int
    {
        $rounded = round($durationSeconds);
        if (abs($durationSeconds - $rounded) <= 0.1) {
            return max(1, (int) $rounded);
        }

        return max(1, (int) ceil($durationSeconds));
    }

    /**
     * 按可信度顺序从任务请求、provider payload 和 Seedance prompt 参数里解析输出时长。
     */
    private function resolveDurationSeconds(VideoQueueOperationEntity $operation, array $providerPayload): int
    {
        foreach ([
            $operation->getRawRequest()['generation']['duration_seconds'] ?? null,
            $providerPayload['parameters']['durationSeconds'] ?? null,
            $providerPayload['durationSeconds'] ?? null,
            $providerPayload['duration'] ?? null,
            $this->extractSeedancePromptOption($providerPayload, 'dur'),
        ] as $candidate) {
            $duration = $this->normalizePositiveInt($candidate);
            if ($duration !== null) {
                return $duration;
            }
        }

        return 0;
    }

    /**
     * 优先解析显式宽高或 size 字段，能拿到真实尺寸时不依赖分辨率档位。
     *
     * @return null|array{size: string, width: int, height: int}
     */
    private function resolveExplicitDimensions(VideoQueueOperationEntity $operation, array $providerPayload): ?array
    {
        foreach ([
            [
                'width' => $operation->getRawRequest()['generation']['width'] ?? null,
                'height' => $operation->getRawRequest()['generation']['height'] ?? null,
            ],
            [
                'size' => $operation->getRawRequest()['generation']['size'] ?? null,
            ],
            [
                'width' => $providerPayload['parameters']['width'] ?? null,
                'height' => $providerPayload['parameters']['height'] ?? null,
            ],
            [
                'width' => $providerPayload['width'] ?? null,
                'height' => $providerPayload['height'] ?? null,
            ],
            [
                'size' => $providerPayload['parameters']['size'] ?? null,
            ],
            [
                'size' => $providerPayload['size'] ?? null,
            ],
        ] as $candidate) {
            $dimensions = $this->normalizeDimensions(
                $candidate['width'] ?? null,
                $candidate['height'] ?? null,
                $candidate['size'] ?? null,
            );
            if ($dimensions !== null) {
                return $dimensions;
            }
        }

        return null;
    }

    /**
     * 已知宽高时优先映射标准分辨率，映射失败再读取请求或 provider 的分辨率字段。
     */
    private function resolveResolutionForDimensions(
        VideoQueueOperationEntity $operation,
        array $providerPayload,
        int $width,
        int $height
    ): ?string {
        return $this->mapResolutionFromDimensions($width, $height) ?? $this->resolveResolutionCandidate([
            $operation->getRawRequest()['generation']['resolution'] ?? null,
            $providerPayload['parameters']['resolution'] ?? null,
            $providerPayload['resolution'] ?? null,
        ]);
    }

    /**
     * 宽高缺失时，从多种 provider 字段里兜底解析分辨率。
     */
    private function resolveFallbackResolution(VideoQueueOperationEntity $operation, array $providerPayload): ?string
    {
        return $this->resolveResolutionCandidate([
            $providerPayload['parameters']['resolution'] ?? null,
            $providerPayload['resolution'] ?? null,
            $operation->getRawRequest()['generation']['resolution'] ?? null,
            $this->resolveResolutionFromWuyinSize($providerPayload['parameters']['size'] ?? null),
            $this->resolveResolutionFromWuyinSize($providerPayload['size'] ?? null),
            $this->resolveResolutionFromKelingMode($providerPayload),
            $this->extractSeedancePromptOption($providerPayload, 'rs'),
            $providerPayload['parameters']['size'] ?? null,
            $providerPayload['size'] ?? null,
        ]);
    }

    /**
     * 从候选值中取第一个合法分辨率。
     *
     * @param list<mixed> $candidates
     */
    private function resolveResolutionCandidate(array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            $resolution = $this->normalizeResolution($candidate);
            if ($resolution !== null) {
                return $resolution;
            }
        }

        return null;
    }

    /**
     * 根据标准分辨率档位返回默认宽高。
     *
     * @return array{size: ?string, width: ?int, height: ?int}
     */
    private function buildDimensionsFromResolution(?string $resolution): array
    {
        $emptyDimensions = [
            'size' => null,
            'width' => null,
            'height' => null,
        ];

        if ($resolution === null) {
            return $emptyDimensions;
        }

        return self::BILLING_RESOLUTION_DIMENSIONS[$resolution] ?? $emptyDimensions;
    }

    /**
     * 根据请求中的 size 或 aspect_ratio 从模型配置里反推出分辨率档位。
     */
    private function resolveResolutionFromConfiguredSize(array $generation, VideoGenerationConfig $videoGenerationConfig): ?string
    {
        $sizeOption = $this->findConfiguredSizeOption($generation, null, $videoGenerationConfig);
        if ($sizeOption === null) {
            return null;
        }

        return $this->normalizeResolution($sizeOption['resolution'] ?? null);
    }

    /**
     * 根据请求和分辨率从模型配置的 size 选项里反查输出宽高。
     *
     * @return null|array{size: string, width: int, height: int}
     */
    private function resolveDimensionsFromConfiguredSize(
        array $generation,
        ?string $resolution,
        VideoGenerationConfig $videoGenerationConfig
    ): ?array {
        $sizeOption = $this->findConfiguredSizeOption($generation, $resolution, $videoGenerationConfig);
        if ($sizeOption === null) {
            return null;
        }

        $width = $this->normalizePositiveInt($sizeOption['width'] ?? null);
        $height = $this->normalizePositiveInt($sizeOption['height'] ?? null);
        if ($width === null || $height === null) {
            return null;
        }

        return [
            'size' => sprintf('%dx%d', $width, $height),
            'width' => $width,
            'height' => $height,
        ];
    }

    /**
     * 在模型 generation.sizes 配置里匹配用户选择的 size 或 aspect_ratio。
     *
     * @return null|array<string, mixed>
     */
    private function findConfiguredSizeOption(
        array $generation,
        ?string $resolution,
        VideoGenerationConfig $videoGenerationConfig
    ): ?array {
        $config = $videoGenerationConfig->toArray();
        $configGeneration = is_array($config['generation'] ?? null) ? $config['generation'] : [];
        $sizes = is_array($configGeneration['sizes'] ?? null) ? $configGeneration['sizes'] : [];
        $requestedSize = strtolower(trim((string) ($generation['size'] ?? '')));
        $requestedAspectRatio = strtolower(trim((string) ($generation['aspect_ratio'] ?? '')));

        foreach ($sizes as $sizeOption) {
            if (! is_array($sizeOption)) {
                continue;
            }

            $optionResolution = $this->normalizeResolution($sizeOption['resolution'] ?? null);
            if ($resolution !== null && $optionResolution !== $resolution) {
                continue;
            }

            if ($requestedSize !== '' && strtolower(trim((string) ($sizeOption['value'] ?? ''))) === $requestedSize) {
                return $sizeOption;
            }

            if ($requestedAspectRatio !== '' && strtolower(trim((string) ($sizeOption['label'] ?? ''))) === $requestedAspectRatio) {
                return $sizeOption;
            }
        }

        return null;
    }

    /**
     * 将宽高映射到标准计费分辨率，横竖屏尺寸等价处理。
     */
    private function mapResolutionFromDimensions(int $width, int $height): ?string
    {
        foreach (self::BILLING_RESOLUTION_DIMENSIONS as $resolution => $dimensions) {
            if (
                ($dimensions['width'] === $width && $dimensions['height'] === $height)
                || ($dimensions['width'] === $height && $dimensions['height'] === $width)
            ) {
                return $resolution;
            }
        }

        return null;
    }

    /**
     * 规范化宽高或 1280x720 形式的 size 字段。
     *
     * @return null|array{size: string, width: int, height: int}
     */
    private function normalizeDimensions(mixed $width, mixed $height, mixed $size): ?array
    {
        $normalizedWidth = $this->normalizePositiveInt($width);
        $normalizedHeight = $this->normalizePositiveInt($height);
        if ($normalizedWidth !== null && $normalizedHeight !== null) {
            return [
                'size' => sprintf('%dx%d', $normalizedWidth, $normalizedHeight),
                'width' => $normalizedWidth,
                'height' => $normalizedHeight,
            ];
        }

        if (! is_string($size)) {
            return null;
        }

        if (preg_match('/^\s*(\d+)\s*x\s*(\d+)\s*$/i', $size, $matches) !== 1) {
            return null;
        }

        $normalizedWidth = (int) $matches[1];
        $normalizedHeight = (int) $matches[2];
        if ($normalizedWidth <= 0 || $normalizedHeight <= 0) {
            return null;
        }

        return [
            'size' => sprintf('%dx%d', $normalizedWidth, $normalizedHeight),
            'width' => $normalizedWidth,
            'height' => $normalizedHeight,
        ];
    }

    /**
     * 无影 provider 的 size 可能直接传 720p/4k，这里单独识别为分辨率。
     */
    private function resolveResolutionFromWuyinSize(mixed $size): ?string
    {
        if (! is_string($size)) {
            return null;
        }

        $normalized = trim($size);
        return preg_match('/^\d+[pk]$/i', $normalized) === 1 ? strtolower($normalized) : null;
    }

    /**
     * 可灵 provider 使用 mode 表达清晰度，计费前需要转换成统一分辨率。
     */
    private function resolveResolutionFromKelingMode(array $providerPayload): ?string
    {
        $mode = $this->normalizeOptionalString($providerPayload['mode'] ?? null);
        if ($mode === null) {
            return null;
        }

        return self::KELING_MODE_TO_RESOLUTION[strtolower($mode)] ?? null;
    }

    /**
     * Seedance provider 会把 dur/rs 等参数拼在 prompt 里，兜底计费时需要解析出来。
     */
    private function extractSeedancePromptOption(array $providerPayload, string $option): ?string
    {
        $content = $providerPayload['content'] ?? null;
        if (! is_array($content)) {
            return null;
        }

        foreach ($content as $item) {
            if (! is_array($item) || ($item['type'] ?? null) !== 'text' || ! is_string($item['text'] ?? null)) {
                continue;
            }

            if (preg_match('/(?:^|\s)--' . preg_quote($option, '/') . '\s+(\S+)/i', $item['text'], $matches) !== 1) {
                continue;
            }

            return $matches[1];
        }

        return null;
    }

    /**
     * 规范化可选字符串，空字符串统一视为 null。
     */
    private function normalizeOptionalString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);
        return $normalized === '' ? null : $normalized;
    }

    /**
     * 只接受计费系统已知的标准分辨率。
     */
    private function normalizeResolution(mixed $value): ?string
    {
        $normalized = $this->normalizeOptionalString($value);
        if ($normalized === null) {
            return null;
        }

        $normalized = strtolower($normalized);

        return array_key_exists($normalized, self::BILLING_RESOLUTION_DIMENSIONS) ? $normalized : null;
    }

    /**
     * 规范化正整数配置或请求值，非法值统一返回 null。
     */
    private function normalizePositiveInt(mixed $value): ?int
    {
        if (is_string($value) && is_numeric($value)) {
            $value = (int) $value;
        }

        return is_int($value) && $value > 0 ? $value : null;
    }
}
