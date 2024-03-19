<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\AggregateSearch;

enum SearchDeepLevel: int
{
    // 简单搜索
    case SIMPLE = 1;

    // 深度搜索
    case DEEP = 2;
}
