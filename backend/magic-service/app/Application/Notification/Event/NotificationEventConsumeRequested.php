<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Event;

final readonly class NotificationEventConsumeRequested
{
    public function __construct(public string $eventId)
    {
    }
}
