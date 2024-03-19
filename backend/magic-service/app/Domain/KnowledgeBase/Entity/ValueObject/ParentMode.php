<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

enum ParentMode: int
{
    case PARAGRAPH = 1;
    case AUTHORITY = 2;

    public function getDescription(): string
    {
        return match ($this) {
            self::PARAGRAPH => '段落',
            self::AUTHORITY => '权重',
        };
    }
}
