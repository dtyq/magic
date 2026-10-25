<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Entity\ValueObject;

enum MicroAppListScope: string
{
    case All = 'all';
    case Created = 'created';
    case Collaborated = 'collaborated';
    case Accessible = 'accessible';
    case Recent = 'recent';
}
