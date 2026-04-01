<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

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

    private function roundDurationSeconds(float $durationSeconds): int
    {
        $rounded = round($durationSeconds);
        if (abs($durationSeconds - $rounded) <= 0.1) {
            return max(1, (int) $rounded);
        }

        return max(1, (int) ceil($durationSeconds));
    }

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

    private function resolveResolutionFromWuyinSize(mixed $size): ?string
    {
        if (! is_string($size)) {
            return null;
        }

        $normalized = trim($size);
        return preg_match('/^\d+[pk]$/i', $normalized) === 1 ? strtolower($normalized) : null;
    }

    private function resolveResolutionFromKelingMode(array $providerPayload): ?string
    {
        $mode = $this->normalizeOptionalString($providerPayload['mode'] ?? null);
        if ($mode === null) {
            return null;
        }

        return self::KELING_MODE_TO_RESOLUTION[strtolower($mode)] ?? null;
    }

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

    private function normalizeOptionalString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);
        return $normalized === '' ? null : $normalized;
    }

    private function normalizeResolution(mixed $value): ?string
    {
        $normalized = $this->normalizeOptionalString($value);
        if ($normalized === null) {
            return null;
        }

        $normalized = strtolower($normalized);

        return array_key_exists($normalized, self::BILLING_RESOLUTION_DIMENSIONS) ? $normalized : null;
    }

    private function normalizePositiveInt(mixed $value): ?int
    {
        if (is_string($value) && is_numeric($value)) {
            $value = (int) $value;
        }

        return is_int($value) && $value > 0 ? $value : null;
    }
}
