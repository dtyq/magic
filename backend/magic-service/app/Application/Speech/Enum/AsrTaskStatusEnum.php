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
    case CREATED = 'created';              // 已创建
    case PROCESSING = 'processing';        // 处理中
    case COMPLETED = 'completed';            // 已完成
    case FAILED = 'failed';                  // 失败

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::CREATED => '已创建',
            self::PROCESSING => '处理中',
            self::COMPLETED => '已完成',
            self::FAILED => '失败',
        };
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
        return self::tryFrom($status) ?? self::FAILED;
    }
}
