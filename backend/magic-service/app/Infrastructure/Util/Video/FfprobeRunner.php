<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Video;

use JsonException;
use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * 执行 ffprobe 读取视频容器信息（format + streams），失败一律抛 RuntimeException。
 */
readonly class FfprobeRunner
{
    private const int TIMEOUT_SECONDS = 10;

    public function __construct(
        private FfmpegBinaryResolver $binaryResolver,
    ) {
    }

    /**
     * @param null|string $explicitBinary 显式指定的 ffprobe 路径，优先级最高
     * @return array<string, mixed> ffprobe 输出的原始结构，含 format / streams
     */
    public function run(string $filePath, ?string $explicitBinary = null): array
    {
        if (! is_file($filePath) || ! is_readable($filePath)) {
            throw new RuntimeException(sprintf('video file is not readable: %s', $filePath));
        }

        $ffprobeBinary = $this->binaryResolver->ffprobe($explicitBinary);
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
                    'ffprobe binary not found: %s, please install ffmpeg or set FFPROBE_BINARY',
                    $ffprobeBinary
                ));
            }

            throw new RuntimeException('ffprobe failed: ' . $message);
        }

        try {
            $payload = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('ffprobe returned invalid json', previous: $exception);
        }

        if (! is_array($payload)) {
            throw new RuntimeException('ffprobe returned invalid json');
        }

        /* @var array<string, mixed> $payload */
        return $payload;
    }
}
