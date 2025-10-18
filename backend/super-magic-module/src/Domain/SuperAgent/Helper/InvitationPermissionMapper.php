<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Helper;

use Dtyq\SuperMagic\Domain\Share\Constant\ShareAccessType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;

/**
 * 邀请权限映射器.
 *
 * 负责在不同权限表示之间进行转换
 */
class InvitationPermissionMapper
{
    /**
     * 邀请权限到成员角色的映射.
     */
    private const PERMISSION_TO_MEMBER_ROLE_MAP = [
        'viewer' => MemberRole::VIEWER,
        'editor' => MemberRole::EDITOR,
        'manage' => MemberRole::MANAGE,
    ];

    /**
     * 邀请权限到分享类型的映射.
     */
    public static function getPermissionToShareTypeMap(): array
    {
        return [
            'viewer' => ShareAccessType::Internet,
            'editor' => ShareAccessType::Internet,
            'manage' => ShareAccessType::Internet,
        ];
    }

    /**
     * 分享类型到邀请权限的映射.
     */
    public static function getShareTypeToPermissionMap(): array
    {
        return [
            ShareAccessType::Internet->value => 'viewer', // 默认权限
        ];
    }

    /**
     * 成员角色到邀请权限的映射.
     */
    public static function getMemberRoleToPermissionMap(): array
    {
        return [
            MemberRole::MANAGE->value => 'editor',
            MemberRole::EDITOR->value => 'edit',
            MemberRole::VIEWER->value => 'viewer',
        ];
    }

    /**
     * 将邀请权限转换为分享类型.
     */
    public static function permissionToShareType(string $permission): ShareAccessType
    {
        $map = self::getPermissionToShareTypeMap();
        return $map[$permission] ?? ShareAccessType::Internet;
    }

    /**
     * 将分享类型转换为邀请权限.
     */
    public static function shareTypeToPermission(int $shareType): string
    {
        $map = self::getShareTypeToPermissionMap();
        return $map[$shareType] ?? 'viewer';
    }

    /**
     * 将邀请权限转换为成员角色.
     */
    public static function permissionToMemberRole(string $permission): MemberRole
    {
        return self::PERMISSION_TO_MEMBER_ROLE_MAP[$permission] ?? MemberRole::VIEWER;
    }

    /**
     * 将成员角色转换为邀请权限.
     */
    public static function memberRoleToPermission(MemberRole $memberRole): string
    {
        $map = self::getMemberRoleToPermissionMap();
        return $map[$memberRole->value] ?? 'viewer';
    }

    /**
     * 获取所有支持的邀请权限.
     */
    public static function getAllPermissions(): array
    {
        return ['viewer', 'editor', 'manage'];
    }
}
