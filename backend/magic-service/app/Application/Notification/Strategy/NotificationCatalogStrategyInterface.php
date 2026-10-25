<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Strategy;

interface NotificationCatalogStrategyInterface
{
    /**
     * @return list<string>
     */
    public function eventTypes(): array;

    /**
     * @return list<string>
     */
    public function notificationTypes(): array;

    public function supportsEvent(string $eventType): bool;

    public function supportsNotification(string $notificationType): bool;

    /** @param array<string, mixed> $payload */
    public function notificationTypeForEvent(string $eventType, array $payload = []): ?string;
}
