<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Constant;

/**
 * 分享访问类型枚举.
 */
enum ShareAccessType: int
{
    case TeamShare = 2;               // 团队内分享（根据 share_range 区分 all/designated）
    case Internet = 4;                // 互联网可访问(公开访问，无需密码)
    case PasswordProtected = 5;       // 密码保护（需要输入密码才能访问）

    /**
     * 获取分享类型的描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::TeamShare => '团队内分享',
            self::Internet => '互联网可访问',
            self::PasswordProtected => '密码保护',
        };
    }

    /**
     * 检查是否需要密码保护（密码必填）.
     */
    public function needsPassword(): bool
    {
        return $this === self::PasswordProtected;
    }

    /**
     * 检查是否支持密码（密码可选）.
     */
    public function supportsPassword(): bool
    {
        return $this === self::Internet || $this === self::PasswordProtected;
    }

    /**
     * 检查是否需要指定目标.
     */
    public function needsTargets(): bool
    {
        return $this === self::TeamShare;
    }

    /**
     * 检查是否需要 share_range.
     */
    public function needsShareRange(): bool
    {
        return $this === self::TeamShare;
    }
}
