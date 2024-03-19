<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 编辑类型枚举.
 */
enum EditType: int
{
    /**
     * 人工编辑.
     */
    case MANUAL = 1;

    /**
     * AI编辑.
     */
    case AI = 2;

    /**
     * 获取编辑类型名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::MANUAL => '人工编辑',
            self::AI => 'AI编辑',
        };
    }

    /**
     * 获取编辑类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::MANUAL => '人工手动编辑的版本',
            self::AI => 'AI自动编辑的版本',
        };
    }
}
