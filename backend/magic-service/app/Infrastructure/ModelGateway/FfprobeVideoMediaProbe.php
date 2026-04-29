<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway;

use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use JsonException;
use RuntimeException;
use Symfony\Component\Process\Process;

readonly class FfprobeVideoMediaProbe implements VideoMediaProbeInterface
{
    private const int TIMEOUT_SECONDS = 5;

    private const string DEFAULT_BINARY = 'ffprobe';

    /**
     * @param null|string $ffprobeBinary ffprobe 可执行文件路径；为空时读取配置并默认使用 PATH 中的 ffprobe
     */
    public function __construct(
        private ?string $ffprobeBinary = null,
    ) {
    }

    public function probe(string $filePath): VideoMediaMetadata
    {
        if (! is_file($filePath) || ! is_readable($filePath)) {
            throw new RuntimeException(sprintf('video file is not readable: %s', $filePath));
        }

        $ffprobeBinary = $this->resolveFfprobeBinary();
        $process = new Process([
            $ffprobeBinary,
            '-v',
            'error',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            $filePath,
        ]);
        $process->setTimeout(self::TIMEOUT_SECONDS);
        $process->run();

        if (! $process->isSuccessful()) {
            $message = trim($process->getErrorOutput() ?: $process->getOutput());
            if ($process->getExitCode() === 127 || str_contains($message, 'not found')) {
                throw new RuntimeException(sprintf(
                    'ffprobe binary not found: %s, please install ffmpeg or set MODEL_GATEWAY_FFPROBE_BINARY',
                    $ffprobeBinary
                ));
            }

            throw new RuntimeException('ffprobe failed: ' . $message);
        }

        try {
            /** @var array{streams?: mixed, format?: mixed} $payload */
            $payload = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('ffprobe returned invalid json', previous: $exception);
        }

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
     * 读取 ffprobe 可执行文件配置；未配置时沿用系统 PATH 中的 ffprobe。
     */
    private function resolveFfprobeBinary(): string
    {
        $binary = $this->ffprobeBinary ?? (string) config('model_gateway.video_media.ffprobe_binary', self::DEFAULT_BINARY);
        $binary = trim($binary);

        return $binary === '' ? self::DEFAULT_BINARY : $binary;
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
