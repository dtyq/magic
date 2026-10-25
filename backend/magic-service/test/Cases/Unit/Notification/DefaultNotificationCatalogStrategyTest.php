<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use PHPUnit\Framework\TestCase;

/** @internal */
final class DefaultNotificationCatalogStrategyTest extends TestCase
{
    public function testAllPublicMessageEventsMapToSupportedTypes(): void
    {
        $catalog = new DefaultNotificationCatalogStrategy();
        foreach ($catalog->eventTypes() as $eventType) {
            $type = $catalog->notificationTypeForEvent($eventType);
            if (str_ends_with($eventType, '.withdrawn')) {
                self::assertNull($type);
            } else {
                self::assertNotNull($type);
                self::assertTrue($catalog->supportsNotification($type));
            }
        }
        self::assertNull($catalog->notificationTypeForEvent('unknown.event'));
        self::assertFalse($catalog->supportsEvent('collaboration.project.invited'));
    }
}
