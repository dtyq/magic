<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway;

use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Infrastructure\Util\Video\FfprobeRunner;
use RuntimeException;

/**
 * 基于 ffprobe 的视频媒体元数据探测，字段缺失时抛异常，不做兜底。
 */
readonly class FfprobeVideoMediaProbe implements VideoMediaProbeInterface
{
    /**
     * @param null|string $ffprobeBinary 显式指定的 ffprobe 路径；为空时由 FfprobeRunner 读环境变量
     */
    public function __construct(
        private FfprobeRunner $fprobeRunner,
        private ?string $ffprobeBinary = null,
    ) {
    }

    public function probe(string $filePath): VideoMediaMetadata
    {
        $payload = $this->fprobeRunner->run($filePath, $this->ffprobeBinary);

        $videoStream = $this->extractVideoStream($payload['streams'] ?? null);
        if ($videoStream === null) {
            throw new RuntimeException('ffprobe video stream missing');
        }

        $width = $this->normalizePositiveInt($videoStream['width'] ?? null);
        $height = $this->normalizePositiveInt($videoStream['height'] ?? null);
        if ($width === null || $height === null) {
            throw new RuntimeException('ffprobe width or height missing');
        }

        $duration = $this->normalizePositiveFloat(
            is_array($payload['format'] ?? null) ? ($payload['format']['duration'] ?? null) : null
        ) ?? $this->normalizePositiveFloat($videoStream['duration'] ?? null);
        if ($duration === null) {
            throw new RuntimeException('ffprobe duration missing');
        }

        return new VideoMediaMetadata($duration, $width, $height);
    }

    /**
     * @return null|array<string, mixed>
     */
    private function extractVideoStream(mixed $streams): ?array
    {
        if (! is_array($streams)) {
            return null;
        }

        foreach ($streams as $stream) {
            if (is_array($stream) && ($stream['codec_type'] ?? null) === 'video') {
                return $stream;
            }
        }

        return null;
    }

    private function normalizePositiveInt(mixed $value): ?int
    {
        if (is_string($value) && is_numeric($value)) {
            $value = (int) $value;
        }

        return is_int($value) && $value > 0 ? $value : null;
    }

    private function normalizePositiveFloat(mixed $value): ?float
    {
        if (is_string($value) && is_numeric($value)) {
            $value = (float) $value;
        }

        if (! is_float($value) && ! is_int($value)) {
            return null;
        }

        $normalized = (float) $value;
        return $normalized > 0 ? $normalized : null;
    }
}
