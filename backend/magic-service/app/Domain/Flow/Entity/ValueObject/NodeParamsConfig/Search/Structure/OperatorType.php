<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure;

enum OperatorType: string
{
    case Equals = 'equals';
    case NoEquals = 'no_equals';
    case Contains = 'contains';
    case NoContains = 'no_contains';
    case Empty = 'empty';
    case NotEmpty = 'not_empty';
}
