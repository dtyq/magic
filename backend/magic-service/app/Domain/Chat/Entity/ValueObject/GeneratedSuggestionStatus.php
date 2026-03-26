<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

enum GeneratedSuggestionStatus: int
{
    /**
     * 生成中.
     */
    case Generating = 0;

    /**
     * 已完成.
     */
    case Done = 1;

    /**
     * 失败.
     */
    case Failed = 2;
}
