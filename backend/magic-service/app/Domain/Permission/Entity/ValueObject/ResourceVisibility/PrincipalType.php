<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\ResourceVisibility;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 主体类型枚举（谁拥有权限）.
 */
enum PrincipalType: int
{
    /**
     * 用户.
     */
    case USER = 1;

    /**
     * 部门.
     */
    case DEPARTMENT = 2;

    /**
     * 组织.
     */
    case ORGANIZATION = 3;

    public static function make(mixed $type): PrincipalType
    {
        if (! is_int($type)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'principal_type']);
        }
        $type = self::tryFrom($type);
        if (! $type) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'principal_type']);
        }
        return $type;
    }
}
