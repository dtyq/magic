<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

use InvalidArgumentException;

/**
 * 转换任务状态枚举.
 */
enum ConvertStatusEnum: string
{
    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case COMPLETED = 'completed';
    case FAILED = 'failed';

    /**
     * 获取所有有效状态值.
     */
    public static function getValidStatuses(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }

    /**
     * 检查状态是否有效.
     */
    public static function isValid(string $status): bool
    {
        return in_array($status, self::getValidStatuses(), true);
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromString(string $status): self
    {
        return match ($status) {
            'pending' => self::PENDING,
            'processing' => self::PROCESSING,
            'completed' => self::COMPLETED,
            'failed' => self::FAILED,
            default => throw new InvalidArgumentException("Invalid status: {$status}"),
        };
    }
}
