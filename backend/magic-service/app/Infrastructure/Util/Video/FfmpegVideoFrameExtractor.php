<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Video;

use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * 基于 ffmpeg / ffprobe 的抽帧实现，任何一步失败都只记日志并返回空数组。
 */
readonly class FfmpegVideoFrameExtractor implements VideoFrameExtractorInterface
{
    private const int FRAME_TIMEOUT_SECONDS = 20;

    /** 输出画面宽度上限，直接决定内联进请求的 Base64 体积。 */
    private const int FRAME_MAX_WIDTH = 512;

    private const string FRAME_FILE_PREFIX = 'video-frame-';

    public function __construct(
        private LoggerInterface $logger,
        private FfprobeRunner $ffprobeRunner,
        private FfmpegBinaryResolver $binaryResolver,
    ) {
    }

    public function extractFrames(string $videoPath, int $frameCount): array
    {
        if ($frameCount < 1 || ! is_file($videoPath) || ! is_readable($videoPath)) {
            return [];
        }

        try {
            $duration = $this->resolveDurationSeconds($this->ffprobeRunner->run($videoPath));
        } catch (Throwable $throwable) {
            $this->logger->warning('视频时长探测失败，放弃抽帧', [
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            return [];
        }

        $frames = [];
        foreach ($this->buildTimestamps($duration, $frameCount) as $timestamp) {
            $framePath = $this->extractSingleFrame($videoPath, $timestamp);
            if ($framePath === null) {
                // 任意一帧抽不出来就整体放弃：缺帧会让「所有帧都符合预期」这个结论不再成立。
                $this->removeFiles($frames);
                return [];
            }
            $frames[] = $framePath;
        }

        return $frames;
    }

    /**
     * 取每段时间的中点：首帧常是黑场或片头，末帧常是渐隐，都不代表视频内容。
     *
     * @return array<int, float>
     */
    private function buildTimestamps(float $duration, int $frameCount): array
    {
        $timestamps = [];
        for ($index = 0; $index < $frameCount; ++$index) {
            $timestamps[] = $duration * ($index + 0.5) / $frameCount;
        }
        return $timestamps;
    }

    /** 抽取单帧，失败返回 null（已在内部记日志）。 */
    private function extractSingleFrame(string $videoPath, float $timestamp): ?string
    {
        $outputPath = $this->buildFramePath();
        // -ss 放在 -i 之前走输入定位，长视频不必从头解码；-nostdin 防止子进程抢占服务端标准输入。
        $command = [
            $this->binaryResolver->ffmpeg(),
            '-nostdin',
            '-y',
            '-ss',
            number_format($timestamp, 3, '.', ''),
            '-i',
            $videoPath,
            '-frames:v',
            '1',
            '-vf',
            sprintf("scale='min(%d,iw)':-2", self::FRAME_MAX_WIDTH),
            '-q:v',
            // ffmpeg 的 qscale（2-31，越大越糊）：只判有无人物，取中间档即可。
            '6',
            $outputPath,
        ];

        try {
            $process = new Process($command);
            $process->setTimeout(self::FRAME_TIMEOUT_SECONDS);
            $process->run();
        } catch (Throwable $throwable) {
            $this->logger->warning('视频抽帧调用失败，放弃抽帧', [
                'timestamp' => $timestamp,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            $this->removeFiles([$outputPath]);
            return null;
        }

        if (! $process->isSuccessful() || ! is_file($outputPath) || (int) filesize($outputPath) === 0) {
            $this->logger->warning('视频抽帧未产出有效画面，放弃抽帧', [
                'timestamp' => $timestamp,
                'exit_code' => $process->getExitCode(),
                'message' => trim($process->getErrorOutput()),
            ]);
            $this->removeFiles([$outputPath]);
            return null;
        }

        return $outputPath;
    }

    /**
     * 从 ffprobe 输出里取出时长；缺失或非法时抛异常，由 extractFrames 统一降级。
     *
     * @param array<string, mixed> $payload
     */
    private function resolveDurationSeconds(array $payload): float
    {
        $duration = is_array($payload['format'] ?? null) ? ($payload['format']['duration'] ?? null) : null;
        if (! is_numeric($duration) || (float) $duration <= 0) {
            throw new RuntimeException('ffprobe duration missing');
        }

        return (float) $duration;
    }

    private function buildFramePath(): string
    {
        return sprintf(
            '%s/%s%s.jpg',
            rtrim(sys_get_temp_dir(), '/'),
            self::FRAME_FILE_PREFIX,
            bin2hex(random_bytes(8)),
        );
    }

    /** @param array<int, string> $paths */
    private function removeFiles(array $paths): void
    {
        foreach ($paths as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }
}
