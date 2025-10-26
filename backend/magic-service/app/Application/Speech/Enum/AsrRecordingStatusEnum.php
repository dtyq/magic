<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * ASR 录音状态枚举.
 */
enum AsrRecordingStatusEnum: string
{
    case START = 'start';         // 开始录音
    case RECORDING = 'recording'; // 录音中（心跳）
    case PAUSED = 'paused';       // 暂停
    case STOPPED = 'stopped';     // 终止

    /**
     * 验证状态值是否有效.
     */
    public static function isValid(string $status): bool
    {
        return in_array($status, ['start', 'recording', 'paused', 'stopped'], true);
    }

    /**
     * 从字符串创建枚举.
     */
    public static function tryFromString(string $status): ?self
    {
        return match ($status) {
            'start' => self::START,
            'recording' => self::RECORDING,
            'paused' => self::PAUSED,
            'stopped' => self::STOPPED,
            default => null,
        };
    }
}
