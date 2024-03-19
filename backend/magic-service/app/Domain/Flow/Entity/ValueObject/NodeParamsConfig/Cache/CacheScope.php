<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Cache;

enum CacheScope: string
{
    case User = 'user';
    case Topic = 'topic';
    case Agent = 'agent';
}
