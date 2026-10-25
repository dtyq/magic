<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Service;

use App\Application\Notification\Strategy\NotificationCatalogStrategyInterface;

final readonly class NotificationEventTypeRegistry
{
    public function __construct(private NotificationCatalogStrategyInterface $catalog)
    {
    }

    public function exists(string $eventType): bool
    {
        return $this->catalog->supportsEvent($eventType);
    }

    public function notificationExists(string $notificationType): bool
    {
        return $this->catalog->supportsNotification($notificationType);
    }
}
