<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 成员状态值对象
 *
 * 封装成员状态的业务逻辑和验证规则
 */
enum MemberStatus: int
{
    case INACTIVE = 0;
    case ACTIVE = 1;

    /**
     * 是否为激活状态
     */
    public function isActive(): bool
    {
        return $this === self::ACTIVE;
    }

    /**
     * 是否为非激活状态
     */
    public function isInactive(): bool
    {
        return $this === self::INACTIVE;
    }

    /**
     * 获取描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::ACTIVE => 'Active',
            self::INACTIVE => 'Inactive',
        };
    }
}
