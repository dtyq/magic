<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * ASR 录音类型枚举.
 *
 * 【作用域】接口参数 - /api/v1/asr/upload-tokens
 * 【用途】区分录音来源类型，决定是否创建预设文件
 * 【使用场景】
 * - 前端录音：实时录音生成音频，需要预设笔记和流式识别文件供前端实时写入
 * - 文件上传：用户直传录音文件，不需要预设文件（已有完整录音）
 */
enum AsrRecordingTypeEnum: string
{
    case FRONTEND_RECORDING = 'frontend_recording';  // 前端录音生成音频
    case FILE_UPLOAD = 'file_upload';                // 直传录音文件

    /**
     * 获取类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::FRONTEND_RECORDING => '前端录音',
            self::FILE_UPLOAD => '文件上传',
        };
    }

    /**
     * 是否需要创建预设文件.
     */
    public function needsPresetFiles(): bool
    {
        return match ($this) {
            self::FRONTEND_RECORDING => true,   // 前端录音需要预设文件（实时写入）
            self::FILE_UPLOAD => false,         // 文件上传不需要预设文件（已有录音）
        };
    }

    /**
     * 从字符串安全创建枚举.
     */
    public static function fromString(string $type): ?self
    {
        return self::tryFrom($type);
    }

    /**
     * 获取默认类型.
     */
    public static function default(): self
    {
        return self::FILE_UPLOAD;  // 默认为文件上传（向后兼容）
    }
}
