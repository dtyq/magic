<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\ValueObject;

enum ModelStatus: string
{
    case Normal = 'normal';
    case Disabled = 'disabled';
    case Deleted = 'deleted';

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::Normal => '正常',
            self::Disabled => '已禁用',
            self::Deleted => '已删除',
        };
    }

    /**
     * 检查是否为可用状态
     */
    public function isAvailable(): bool
    {
        return $this === self::Normal;
    }
}
