<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

enum AssetTagNodeType: string
{
    case Group = 'group';
    case Tag = 'tag';
}
