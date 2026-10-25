<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Event\Subscribe;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Event\SlidesTemplateBatchReindexRequestedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateCreatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateDeletedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateStatusUpdatedEvent;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUpdatedEvent;
use App\Domain\SlidesTemplate\Service\SlidesTemplateVectorIndexDomainService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[AsyncListener(driver: 'queue_amqp')]
#[Listener]
final readonly class SlidesTemplateVectorIndexSyncSubscriber implements ListenerInterface
{
    private const int MAX_BATCH_ITEM_RETRIES = 3;

    private LoggerInterface $logger;

    public function __construct(
        private SlidesTemplateVectorIndexDomainService $domainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('vector-index-sync');
    }

    /** Listen only to concrete SlidesTemplate domain events. */
    public function listen(): array
    {
        return [
            SlidesTemplateCreatedEvent::class,
            SlidesTemplateUpdatedEvent::class,
            SlidesTemplateBatchReindexRequestedEvent::class,
            SlidesTemplateStatusUpdatedEvent::class,
            SlidesTemplateDeletedEvent::class,
        ];
    }

    /** Synchronize the latest template state after any relevant domain event. */
    public function process(object $event): void
    {
        if ($event instanceof SlidesTemplateBatchReindexRequestedEvent) {
            $this->processBatchReindex($event);
            return;
        }

        [$resourceId, $organizationCode, $operatorId] = match (true) {
            $event instanceof SlidesTemplateCreatedEvent,
            $event instanceof SlidesTemplateUpdatedEvent,
            $event instanceof SlidesTemplateStatusUpdatedEvent,
            $event instanceof SlidesTemplateDeletedEvent => [
                $event->slidesTemplateId,
                $event->organizationCode,
                $event->operatorId,
            ],
            default => [null, null, null],
        };

        if (! is_string($resourceId) || ! is_string($organizationCode) || ! is_string($operatorId)) {
            return;
        }

        $this->syncOne($resourceId, $organizationCode, $operatorId);
    }

    private function syncOne(
        string $resourceId,
        string $organizationCode,
        string $operatorId,
        bool $forceReEmbedding = false,
    ): void {
        $dataIsolation = new SlidesTemplateDataIsolation();
        $dataIsolation->setCurrentOrganizationCode($organizationCode);
        $dataIsolation->setCurrentUserId($operatorId);
        $dataIsolation->setMagicId($operatorId);
        $dataIsolation->setEnabled(true);
        $dataIsolation->setContainOfficialOrganization(true);

        $context = [
            'resource_type' => 'slides_template',
            'resource_id' => $resourceId,
            'organization_code' => $organizationCode,
            'operator_id' => $operatorId,
            'force_re_embedding' => $forceReEmbedding,
        ];

        try {
            $this->logger->info('Vector index sync started', $context);
            $this->domainService->sync($dataIsolation, $resourceId, $operatorId, $forceReEmbedding);
            $this->logger->info('Vector index sync completed', $context);
        } catch (Throwable $throwable) {
            $this->logger->error('Vector index sync failed', $context + [
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }
    }

    private function processBatchReindex(SlidesTemplateBatchReindexRequestedEvent $event): void
    {
        foreach (array_values(array_unique(array_map('strval', $event->slidesTemplateIds))) as $slidesTemplateId) {
            for ($attempt = 1; $attempt <= self::MAX_BATCH_ITEM_RETRIES; ++$attempt) {
                try {
                    $this->syncOne(
                        $slidesTemplateId,
                        $event->organizationCode,
                        $event->operatorId,
                        $event->forceReEmbedding,
                    );
                    continue 2;
                } catch (Throwable $throwable) {
                    if ($attempt === self::MAX_BATCH_ITEM_RETRIES) {
                        $this->logger->error('Slides template batch item exhausted retries', [
                            'resource_id' => $slidesTemplateId,
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
