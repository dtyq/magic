<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Code\Structure;

enum CodeMode: string
{
    case Normal = 'normal';
    case ImportCode = 'import_code';
}
