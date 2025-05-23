<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

enum SourceType: int
{
    /**
     * 外部文件.
     */
    case EXTERNAL_FILE = 1;
}
