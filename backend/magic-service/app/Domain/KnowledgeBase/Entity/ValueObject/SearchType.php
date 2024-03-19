<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

enum SearchType: int
{
    case ALL = 1;
    case ENABLED = 2;
    case DISABLED = 3;
}
