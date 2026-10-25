<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Archive\Entity\ValueObject;

enum ArchiveMode: string
{
    case Full = 'full';
    case Incremental = 'incremental';
}
