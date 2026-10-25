<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Enum;

enum FileDeletionPolicy: string
{
    case RecycleBin = 'recycle_bin';
    case PhysicalDelete = 'physical_delete';
}
