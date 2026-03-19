<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\ResourceVisibility;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 资源类型枚举（对什么有权限）.
 */
enum ResourceType: int
{
    /**
     * 自定义智能体.
     */
    case SUPER_MAGIC_AGENT = 1;

    /**
     * Skill resource.
     */
    case SKILL = 2;

    public static function make(mixed $type): ResourceType
    {
        if (! is_int($type)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'resource_type']);
        }
        $type = self::tryFrom($type);
        if (! $type) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'resource_type']);
        }
        return $type;
    }
}
