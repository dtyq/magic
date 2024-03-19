<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile;

enum DocumentFileType: int
{
    case EXTERNAL = 1;
    case THIRD_PLATFORM = 2;
}
