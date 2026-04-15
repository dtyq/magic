<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

enum FragmentMode: int
{
    case CUSTOM = 1;
    case AUTO = 2;
    case HIERARCHY = 3;

    public function getDescription(): string
    {
        return match ($this) {
            self::CUSTOM => '自定义',
            self::AUTO => '自动分段与清洗',
            self::HIERARCHY => '按层级分段',
        };
    }
}
