<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Event;

use App\Application\Notification\Service\NotificationConsumerService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

// Collaboration producers publish inside a transaction. The coroutine driver
// defers consumption until that coroutine exits, after its transaction commits;
// an AMQP worker can otherwise receive an uncommitted async-event record.
#[AsyncListener(driver: 'coroutine')]
#[Listener]
final readonly class NotificationEventConsumeListener implements ListenerInterface
{
    public function __construct(private NotificationConsumerService $consumer)
    {
    }

    public function listen(): array
    {
        return [NotificationEventConsumeRequested::class];
    }

    public function process(object $event): void
    {
        if ($event instanceof NotificationEventConsumeRequested) {
            $this->consumer->consume($event->eventId);
        }
    }
}
