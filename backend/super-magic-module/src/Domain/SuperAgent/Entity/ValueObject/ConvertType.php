<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

enum ConvertType: string
{
    case PDF = 'pdf';
    case PPT = 'ppt';
    case IMAGE = 'image';
}
