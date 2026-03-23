<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

/**
 * Agent 来源类型枚举.
 */
enum AgentSourceType: string
{
    /**
     * 本地创建（用户自己创建的 Agent）.
     */
    case LOCAL_CREATE = 'LOCAL_CREATE';

    /**
     * 商店添加（从商店添加的 Agent）.
     */
    case MARKET = 'MARKET';

    /**
     * 获取来源类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::LOCAL_CREATE => '本地创建',
            self::MARKET => '商店添加',
        };
    }

    /**
     * 是否为本地创建.
     */
    public function isLocalCreate(): bool
    {
        return $this === self::LOCAL_CREATE;
    }

    /**
     * 是否为商店添加.
     */
    public function isMarket(): bool
    {
        return $this === self::MARKET;
    }

    /**
     * 从值创建枚举.
     */
    public static function fromValue(?string $value): ?self
    {
        if ($value === null) {
            return null;
        }

        return self::tryFrom($value);
    }

    /**
     * 获取所有来源类型值.
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
