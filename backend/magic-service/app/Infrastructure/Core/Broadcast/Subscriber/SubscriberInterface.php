<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Broadcast\Subscriber;

use Closure;

interface SubscriberInterface
{
    public function subscribe(string $channel, Closure $closure, bool $async = true): void;
}
