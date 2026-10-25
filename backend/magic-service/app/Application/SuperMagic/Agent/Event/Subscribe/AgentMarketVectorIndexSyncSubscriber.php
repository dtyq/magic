<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Event\Subscribe;

use App\Domain\SuperMagic\Agent\Event\AgentMarketBatchReindexRequestedEvent;
use App\Domain\SuperMagic\Agent\Event\AgentMarketOfflineEvent;
use App\Domain\SuperMagic\Agent\Event\AgentMarketPublishedEvent;
use App\Domain\SuperMagic\Agent\Event\AgentMarketUpdatedEvent;
use App\Domain\SuperMagic\Agent\Service\AgentMarketVectorIndexDomainService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[AsyncListener(driver: 'queue_amqp')]
#[Listener]
final readonly class AgentMarketVectorIndexSyncSubscriber implements ListenerInterface
{
    private const MAX_BATCH_ITEM_RETRIES = 3;

    private LoggerInterface $logger;

    public function __construct(
        private AgentMarketVectorIndexDomainService $domainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('vector-index-sync');
    }

    public function listen(): array
    {
        return [
            AgentMarketPublishedEvent::class,
            AgentMarketUpdatedEvent::class,
            AgentMarketOfflineEvent::class,
            AgentMarketBatchReindexRequestedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof AgentMarketBatchReindexRequestedEvent) {
            $this->processBatch($event);
            return;
        }

        if (! $event instanceof AgentMarketPublishedEvent
            && ! $event instanceof AgentMarketUpdatedEvent
            && ! $event instanceof AgentMarketOfflineEvent) {
            return;
        }

        $this->syncOne($event->agentMarketId, $event->operatorId);
    }

    private function syncOne(string $agentMarketId, string $operatorId, bool $forceReEmbedding = false): void
    {
        $context = [
            'resource_type' => 'agent_market',
            'resource_id' => $agentMarketId,
            'operator_id' => $operatorId,
        ];

        try {
            $this->logger->info('Agent market vector index sync started', $context);
            $this->domainService->sync($agentMarketId, $operatorId, $forceReEmbedding);
            $this->logger->info('Agent market vector index sync completed', $context);
        } catch (Throwable $throwable) {
            $this->logger->error('Agent market vector index sync failed', $context + [
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }
    }

    private function processBatch(AgentMarketBatchReindexRequestedEvent $event): void
    {
        foreach (array_values(array_unique(array_map('strval', $event->agentMarketIds))) as $agentMarketId) {
            for ($attempt = 1; $attempt <= self::MAX_BATCH_ITEM_RETRIES; ++$attempt) {
                try {
                    $this->syncOne($agentMarketId, $event->operatorId, $event->forceReEmbedding);
                    continue 2;
                } catch (Throwable $throwable) {
                    if ($attempt === self::MAX_BATCH_ITEM_RETRIES) {
                        $this->logger->error('Agent market batch item exhausted retries', [
                            'resource_id' => $agentMarketId,
                            'attempts' => self::MAX_BATCH_ITEM_RETRIES,
                            'exception' => $throwable::class,
                            'message' => $throwable->getMessage(),
                        ]);
                    }
                }
            }
        }
    }
}
