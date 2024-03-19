<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

/**
 * 模型类型枚举.
 * ATOM: 普通模型（原子模型）
 * DYNAMIC: 动态模型（聚合模型）.
 */
enum ProviderModelType: string
{
    case ATOM = 'ATOM';
    case DYNAMIC = 'DYNAMIC';

    /**
     * 获取类型描述.
     */
    public function label(): string
    {
        return match ($this) {
            self::ATOM => '普通模型',
            self::DYNAMIC => '动态模型',
        };
    }

    /**
     * 判断是否为动态模型.
     */
    public function isDynamic(): bool
    {
        return $this === self::DYNAMIC;
    }

    /**
     * 判断是否为普通模型.
     */
    public function isAtom(): bool
    {
        return $this === self::ATOM;
    }
}
