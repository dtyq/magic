<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Video;

use function Hyperf\Support\env;

/**
 * 解析 ffmpeg / ffprobe 可执行文件路径，优先环境变量，全为空时退回 PATH 默认命令名。
 */
class FfmpegBinaryResolver
{
    private const string DEFAULT_FFMPEG = 'ffmpeg';

    private const string DEFAULT_FFPROBE = 'ffprobe';

    /**
     * @param null|string $explicit 显式指定的路径，优先级高于环境变量（部署覆盖与单测替身用）
     */
    public function ffmpeg(?string $explicit = null): string
    {
        return $this->firstNonEmpty($explicit, env('FFMPEG_BINARY')) ?? self::DEFAULT_FFMPEG;
    }

    /**
     * MODEL_GATEWAY_FFPROBE_BINARY 是历史变量名，保留兼容。
     *
     * @param null|string $explicit 显式指定的路径，优先级高于环境变量（部署覆盖与单测替身用）
     */
    public function ffprobe(?string $explicit = null): string
    {
        return $this->firstNonEmpty(
            $explicit,
            env('FFPROBE_BINARY'),
            env('MODEL_GATEWAY_FFPROBE_BINARY'),
        ) ?? self::DEFAULT_FFPROBE;
    }

    private function firstNonEmpty(?string ...$candidates): ?string
    {
        foreach ($candidates as $candidate) {
            $binary = trim((string) $candidate);
            if ($binary !== '') {
                return $binary;
            }
        }

        return null;
    }
}
