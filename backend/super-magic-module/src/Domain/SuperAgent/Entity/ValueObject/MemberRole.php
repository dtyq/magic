<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

use function Hyperf\Translation\trans;

/**
 * 成员角色值对象
 *
 * 封装成员角色的业务逻辑和权限验证规则
 */
enum MemberRole: string
{
    case OWNER = 'owner';
    case MANAGE = 'manage';
    case EDITOR = 'editor';
    case VIEWER = 'viewer';

    /**
     * 从字符串创建实例.
     */
    public static function fromString(string $role): self
    {
        return match ($role) {
            'owner' => self::OWNER,
            'manage' => self::MANAGE,
            'editor' => self::EDITOR,
            'viewer' => self::VIEWER,
            default => ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_ROLE, trans('project.invalid_member_role'))
        };
    }

    /**
     * 从值创建实例.
     */
    public static function fromValue(string $value): self
    {
        return self::from($value);
    }

    /**
     * 获取值
     */
    public function getValue(): string
    {
        return $this->value;
    }

    /**
     * 是否为所有者角色.
     */
    public function isOwner(): bool
    {
        return $this === self::OWNER;
    }

    /**
     * 是否为管理者角色.
     */
    public function isManager(): bool
    {
        return $this === self::MANAGE;
    }

    /**
     * 是否为编辑者角色.
     */
    public function isEditor(): bool
    {
        return $this === self::EDITOR;
    }

    /**
     * 是否为查看者角色.
     */
    public function isViewer(): bool
    {
        return $this === self::VIEWER;
    }

    /**
     * 是否有写入权限.
     */
    public function hasWritePermission(): bool
    {
        return match ($this) {
            self::OWNER, self::MANAGE, self::EDITOR => true,
            self::VIEWER => false,
        };
    }

    /**
     * 是否有删除权限.
     */
    public function hasDeletePermission(): bool
    {
        return $this === self::OWNER;
    }

    /**
     * 是否有管理权限（邀请成员、设置权限等）.
     */
    public function hasManagePermission(): bool
    {
        return match ($this) {
            self::OWNER, self::MANAGE => true,
            self::EDITOR, self::VIEWER => false,
        };
    }

    /**
     * 是否有分享权限.
     */
    public function hasSharePermission(): bool
    {
        return match ($this) {
            self::OWNER, self::MANAGE, self::EDITOR => true,
            self::VIEWER => false,
        };
    }

    /**
     * 是否可以设置快捷方式.
     */
    public function canSetShortcut(): bool
    {
        return $this->hasSharePermission();
    }

    /**
     * 获取权限等级（数字越大权限越高）.
     */
    public function getPermissionLevel(): int
    {
        return match ($this) {
            self::VIEWER => 1,
            self::EDITOR => 2,
            self::MANAGE => 3,
            self::OWNER => 4,
        };
    }

    /**
     * 比较角色权限等级.
     */
    public function isHigherOrEqualThan(self $other): bool
    {
        return $this->getPermissionLevel() >= $other->getPermissionLevel();
    }

    /**
     * 获取所有可用的角色.
     */
    public static function getAllRoles(): array
    {
        return [self::OWNER, self::MANAGE, self::EDITOR, self::VIEWER];
    }

    /**
     * 获取所有角色的字符串值.
     */
    public static function getAllRoleValues(): array
    {
        return array_map(fn ($role) => $role->value, self::getAllRoles());
    }

    /**
     * 验证权限级别.
     */
    public static function validatePermissionLevel(string $permission): MemberRole
    {
        $validPermissions = [
            MemberRole::MANAGE->value,
            MemberRole::EDITOR->value,
            MemberRole::VIEWER->value,
        ];

        if (! in_array($permission, $validPermissions, true)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_ROLE, trans('project.invalid_member_role'));
        }

        return MemberRole::from($permission);
    }
}
