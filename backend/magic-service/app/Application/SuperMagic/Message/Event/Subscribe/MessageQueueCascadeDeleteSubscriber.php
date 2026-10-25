<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Event\Subscribe;

use App\Application\SuperMagic\Project\Event\Subscribe\ProjectDeletedSubscriber;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Topic\Event\TopicDeletedEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[AsyncListener]
#[Listener]
class MessageQueueCascadeDeleteSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MessageQueueDomainService $messageQueueDomainService,
        LoggerFactory $loggerFactory,
        private readonly ProjectDeletedSubscriber $projectDeletedSubscriber,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            TopicDeletedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        // Previously persisted async events still reference this listener.
        if ($event instanceof ProjectDeletedEvent || $event instanceof ProjectsBatchDeletedEvent) {
            $this->projectDeletedSubscriber->process($event);
            return;
        }

        $eventClass = get_class($event);

        try {
            if ($event instanceof TopicDeletedEvent) {
                $topicIds = [(int) $event->getTopicEntity()->getId()];
                $reason = 'Topic deleted, message queue cascade cleanup';
                $affectedRows = $this->messageQueueDomainService->cascadeDeleteUnfinishedByTopicIds($topicIds, $reason);
                $this->logCompleted($eventClass, $topicIds, [], $affectedRows, $reason);
                return;
            }
        } catch (Throwable $e) {
            $this->logger->error('Message queue cascade cleanup failed', [
                'event_class' => $eventClass,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * @param int[] $topicIds
     * @param int[] $projectIds
     */
    private function logCompleted(
        string $eventClass,
        array $topicIds,
        array $projectIds,
        int $affectedRows,
        string $reason
    ): void {
        $this->logger->info('Message queue cascade cleanup completed', [
            'event_class' => $eventClass,
            'topic_ids' => $topicIds,
            'project_ids' => $projectIds,
            'affected_rows' => $affectedRows,
            'reason' => $reason,
        ]);
    }
}
