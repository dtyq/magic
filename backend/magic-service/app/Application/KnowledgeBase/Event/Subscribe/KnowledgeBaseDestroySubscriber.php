<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Application\KnowledgeBase\Service\KnowledgeBaseVectorAppService;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseRemovedEvent;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

use function di;

#[Listener]
readonly class KnowledgeBaseDestroySubscriber implements ListenerInterface
{
    public function __construct()
    {
    }

    public function listen(): array
    {
        return [
            KnowledgeBaseRemovedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof KnowledgeBaseRemovedEvent) {
            return;
        }
        $knowledge = $event->magicFlowKnowledgeEntity;
        /** @var KnowledgeBaseDomainService $magicFlowKnowledgeDomainService */
        $magicFlowKnowledgeDomainService = di(KnowledgeBaseDomainService::class);
        /** @var KnowledgeBaseVectorAppService $knowledgeBaseVectorService */
        $knowledgeBaseVectorService = di(KnowledgeBaseVectorAppService::class);

        try {
            $knowledgeBaseVectorService->checkCollectionExists($knowledge);
            $knowledge->getVectorDBDriver()->removeCollection($knowledge->getCollectionName());
            $knowledge->setSyncStatus(KnowledgeSyncStatus::Deleted);
        } catch (Throwable $throwable) {
            $knowledge->setSyncStatus(KnowledgeSyncStatus::DeleteFailed);
            $knowledge->setSyncStatusMessage($throwable->getMessage());
        }
        $magicFlowKnowledgeDomainService->changeSyncStatus($knowledge);
    }
}
