<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Constant;

/**
 * 分享用户类型枚举.
 */
enum ShareUserType: string
{
    case Guest = 'guest';              // 游客（其他组织的登录用户）
    case TeamMember = 'team_member';   // 团队成员（同组织的登录用户）
    case Anonymous = 'anonymous';      // 匿名用户（未登录用户）

    /**
     * 获取用户类型的描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::Guest => '游客',
            self::TeamMember => '团队成员',
            self::Anonymous => '匿名用户',
        };
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromString(string $value): ?self
    {
        return match ($value) {
            'guest' => self::Guest,
            'team_member' => self::TeamMember,
            'anonymous' => self::Anonymous,
            default => null,
        };
    }

    /**
     * 获取所有可用的用户类型值.
     * @return array<string>
     */
    public static function values(): array
    {
        return ['guest', 'team_member', 'anonymous'];
    }

    /**
     * 获取复制日志支持的用户类型值（不包括 anonymous，因为复制需要登录）.
     * @return array<string>
     */
    public static function copyLogValues(): array
    {
        return ['guest', 'team_member'];
    }

    /**
     * 检查给定的值是否是有效的用户类型.
     */
    public static function isValid(string $value): bool
    {
        return in_array($value, self::values(), true);
    }

    /**
     * 检查给定的值是否是有效的复制日志用户类型.
     */
    public static function isValidForCopyLog(string $value): bool
    {
        return in_array($value, self::copyLogValues(), true);
    }

    /**
     * 判断是否为匿名用户（包括 anonymous 和 guest）.
     */
    public function isAnonymous(): bool
    {
        return $this === self::Anonymous || $this === self::Guest;
    }

    /**
     * 判断是否为团队成员.
     */
    public function isTeamMember(): bool
    {
        return $this === self::TeamMember;
    }
}
