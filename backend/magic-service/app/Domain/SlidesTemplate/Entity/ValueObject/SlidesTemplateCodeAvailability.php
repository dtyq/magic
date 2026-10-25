<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Entity\ValueObject;

enum SlidesTemplateCodeAvailability: string
{
    case Unused = 'UNUSED';
    case OwnedByMe = 'OWNED_BY_ME';
    case Occupied = 'OCCUPIED';
}
