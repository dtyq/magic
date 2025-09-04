<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * ASR任务状态枚举.
 */
enum AsrTaskStatusEnum: string
{
    case NOT_PROCESSED = 'not_processed';    // 未处理
    case PROCESSING = 'processing';          // 处理中
    case COMPLETED = 'completed';            // 已完成
    case FAILED = 'failed';                  // 失败

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::NOT_PROCESSED => '未处理',
            self::PROCESSING => '处理中',
            self::COMPLETED => '已完成',
            self::FAILED => '失败',
        };
    }

    /**
     * 检查是否为终态
     */
    public function isTerminal(): bool
    {
        return $this === self::COMPLETED || $this === self::FAILED;
    }

    /**
     * 检查是否为成功状态
     */
    public function isSuccess(): bool
    {
        return $this === self::COMPLETED;
    }

    /**
     * 从字符串创建枚举.
     */
    public static function fromString(string $status): self
    {
        return self::tryFrom($status) ?? self::NOT_PROCESSED;
    }
}
