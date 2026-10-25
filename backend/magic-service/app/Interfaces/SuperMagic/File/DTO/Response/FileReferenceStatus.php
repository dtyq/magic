<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Response;

enum FileReferenceStatus: string
{
    case Resolved = 'resolved';
    case Unavailable = 'unavailable';
    case Invalid = 'invalid';
}
