<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Video;

/**
 * 从本地视频文件抽取若干帧画面，抽出的帧写在系统临时目录，由调用方负责删除。
 */
interface VideoFrameExtractorInterface
{
    /**
     * 在视频时长上均匀抽取 $frameCount 帧。
     *
     * @return array<int, string> 帧图片的本地绝对路径，按时间顺序排列；任何异常都返回空数组（由调用方降级）
     */
    public function extractFrames(string $videoPath, int $frameCount): array;
}
