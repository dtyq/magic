<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\OperationPermission;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum TargetType: int
{
    /**
     * 用户.
     */
    case UserId = 1;

    /**
     * 部门.
     */
    case DepartmentId = 2;

    /**
     * 群聊.
     */
    case GroupId = 3;

    public static function make(mixed $type): TargetType
    {
        if (! is_int($type)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'target_type']);
        }
        $type = self::tryFrom($type);
        if (! $type) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'target_type']);
        }
        return $type;
    }
}
