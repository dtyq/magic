<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Event\Subscribe;

use App\Domain\SuperMagic\Task\Service\SandboxKeepAliveDomainService;
use App\Domain\SuperMagic\Topic\Event\TopicDeletedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[Listener]
class SandboxKeepAliveCleanupSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly SandboxKeepAliveDomainService $sandboxKeepAliveDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function listen(): array
    {
        return [
            TopicDeletedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        try {
            match (true) {
                $event instanceof TopicDeletedEvent => $this->handleTopicDeleted($event),
                default => null,
            };
        } catch (Throwable $throwable) {
            $this->logger->error('Sandbox keep alive cleanup failed', [
                'event' => get_class($event),
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        }
    }

    private function handleTopicDeleted(TopicDeletedEvent $event): void
    {
        $topic = $event->getTopicEntity();
        $disabled = $this->sandboxKeepAliveDomainService->disableByTopic(
            $topic->getId(),
            'topic deleted'
        );

        $this->logger->info('Disabled sandbox keep alive record for deleted topic', [
            'topic_id' => $topic->getId(),
            'project_id' => $topic->getProjectId(),
            'disabled' => $disabled,
        ]);
    }
}
