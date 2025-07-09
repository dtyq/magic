<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 项目状态枚举.
 */
enum ProjectStatus: int
{
    /**
     * 活跃状态
     */
    case ACTIVE = 1;

    /**
     * 已归档.
     */
    case ARCHIVED = 2;

    /**
     * 已删除.
     */
    case DELETED = 3;

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::ACTIVE => '活跃',
            self::ARCHIVED => '已归档',
            self::DELETED => '已删除',
        };
    }

    /**
     * 是否为活跃状态
     */
    public function isActive(): bool
    {
        return $this === self::ACTIVE;
    }

    /**
     * 是否已归档.
     */
    public function isArchived(): bool
    {
        return $this === self::ARCHIVED;
    }

    /**
     * 是否已删除.
     */
    public function isDeleted(): bool
    {
        return $this === self::DELETED;
    }
}
