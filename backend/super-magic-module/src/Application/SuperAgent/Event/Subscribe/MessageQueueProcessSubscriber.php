<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Application\SuperAgent\Service\MessageQueueProcessAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Message Queue Process Subscriber
 * Listens to RunTaskCallbackEvent and processes pending message queues when task is completed.
 */
#[AsyncListener]
#[Listener]
class MessageQueueProcessSubscriber implements ListenerInterface
{
    protected LoggerInterface $logger;

    public function __construct()
    {
        $this->logger = di(LoggerFactory::class)->get(self::class);
    }

    /**
     * Listen to events.
     */
    public function listen(): array
    {
        return [
            RunTaskCallbackEvent::class,
        ];
    }

    /**
     * Process the event.
     */
    public function process(object $event): void
    {
        // Type check
        if (! $event instanceof RunTaskCallbackEvent) {
            return;
        }

        $this->logger->info('Received RunTaskCallbackEvent, processing message queue', [
            'topic_id' => $event->getTopicId(),
            'task_id' => $event->getTaskId(),
        ]);

        try {
            // Process message queue for this topic
            di(MessageQueueProcessAppService::class)->processTopicMessageQueue($event->getTopicId());
        } catch (Throwable $e) {
            $this->logger->error('Failed to process message queue after task callback', [
                'topic_id' => $event->getTopicId(),
                'task_id' => $event->getTaskId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
