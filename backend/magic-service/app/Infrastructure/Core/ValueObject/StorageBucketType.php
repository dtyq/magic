<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ValueObject;

enum StorageBucketType: string
{
    case Public = 'public';
    case Private = 'private';
    case SandBox = 'sandbox';
}
