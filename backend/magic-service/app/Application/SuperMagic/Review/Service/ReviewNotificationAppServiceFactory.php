<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Review\Service;

use App\Application\Notification\Contract\NotificationEventPublisherInterface;
use Psr\Container\ContainerInterface;

final class ReviewNotificationAppServiceFactory
{
    public function __invoke(ContainerInterface $container): ReviewNotificationAppService
    {
        // Hyperf skips optional constructor parameters during autowiring.
        return new ReviewNotificationAppService(
            $container->get(NotificationEventPublisherInterface::class),
            $container->get(ReviewNotificationRecipientsInterface::class),
        );
    }
}
