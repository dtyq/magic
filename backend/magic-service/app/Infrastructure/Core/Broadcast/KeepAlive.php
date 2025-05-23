<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Broadcast;

use App\Infrastructure\Core\Broadcast\Publisher\PublisherInterface;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Coordinator\Timer;

class KeepAlive
{
    public const string PING = 'ping';

    public static function create(string $channel): void
    {
        di(Timer::class)->tick(30, function () use ($channel) {
            $locker = di(LockerInterface::class);
            $owner = 'KeepAlive_' . $channel;
            if (! $locker->mutexLock($channel, $owner, 25)) {
                return;
            }
            try {
                $publisher = di(PublisherInterface::class);
                $publisher->publish($channel, uniqid(KeepAlive::PING . '-'));
            } finally {
                $locker->release($channel, $owner);
            }
        });
    }

    public static function isPing(string $message): bool
    {
        return str_starts_with($message, KeepAlive::PING);
    }
}
