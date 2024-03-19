<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

enum PublisherType: string
{
    case USER = 'USER';
    case OFFICIAL = 'OFFICIAL';
    case VERIFIED_CREATOR = 'VERIFIED_CREATOR';
    case PARTNER = 'PARTNER';
}
