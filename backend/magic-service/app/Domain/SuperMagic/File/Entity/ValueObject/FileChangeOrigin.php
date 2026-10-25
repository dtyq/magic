<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Entity\ValueObject;

enum FileChangeOrigin: string
{
    case NORMAL = 'normal';
    case VERSION_ROLLBACK = 'version_rollback';
}
