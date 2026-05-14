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

    /**
     * 将别名转换为权限域目标类型。
     */
    public static function fromAlias(string $alias): self
    {
        return match (strtolower($alias)) {
            'user' => self::UserId,
            'department' => self::DepartmentId,
            'group' => self::GroupId,
            default => ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'target_type']),
        };
    }

    /**
     * 将权限域目标类型转换为别名。
     */
    public function toAlias(): string
    {
        return match ($this) {
            self::UserId => 'User',
            self::DepartmentId => 'Department',
            self::GroupId => 'Group',
        };
    }

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

    public function isUser(): bool
    {
        return $this === self::UserId;
    }

    public function isDepartment(): bool
    {
        return $this === self::DepartmentId;
    }

    public function isGroup(): bool
    {
        return $this === self::GroupId;
    }
}
