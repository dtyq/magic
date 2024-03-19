<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\OperationPermission;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum Operation: int
{
    case None = 0;
    case Owner = 1;
    case Admin = 2;
    case Read = 3;
    case Edit = 4;

    public function canRead(): bool
    {
        return match ($this) {
            self::Owner, self::Admin, self::Read, self::Edit => true,
            default => false,
        };
    }

    public function canEdit(): bool
    {
        return match ($this) {
            self::Owner, self::Admin, self::Edit => true,
            default => false,
        };
    }

    public function canDelete(): bool
    {
        return match ($this) {
            self::Owner, self::Admin => true,
            default => false,
        };
    }

    public function canManage(): bool
    {
        return match ($this) {
            self::Owner, self::Admin => true,
            default => false,
        };
    }

    public function canTransfer(): bool
    {
        return match ($this) {
            self::Owner => true,
            default => false,
        };
    }

    public function validate(string $operation, string $label): self
    {
        $operation = strtolower($operation);
        $bool = match ($operation) {
            'read', 'r' => $this->canRead(),
            'edit', 'w' => $this->canEdit(),
            'delete', 'del', 'd' => $this->canDelete(),
            'manage', 'root' => $this->canManage(),
            'transfer' => $this->canTransfer(),
            default => false,
        };
        if (! $bool) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'common.access', ['label' => $label ?: $operation]);
        }
        return $this;
    }

    public function isOwner(): bool
    {
        return $this === self::Owner;
    }

    public static function make(mixed $type): Operation
    {
        if (! is_int($type)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'operation']);
        }
        $type = self::tryFrom($type);
        if (! $type) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'operation']);
        }
        return $type;
    }

    public function gt(?Operation $operation = null): bool
    {
        // 比较权限，如果当前权限大于传入的权限则返回true
        $level = [
            self::Owner,
            self::Admin,
            self::Edit,
            self::Read,
        ];
        if ($operation === null) {
            return true;
        }
        return array_search($this, $level) < array_search($operation, $level);
    }
}
