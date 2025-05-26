<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseFragmentRemovedEvent;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;
use Throwable;

#[AsyncListener]
#[Listener]
readonly class KnowledgeBaseFragmentDestroySubscriber implements ListenerInterface
{
    public function __construct(private ContainerInterface $container)
    {
    }

    public function listen(): array
    {
        return [
            KnowledgeBaseFragmentRemovedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof KnowledgeBaseFragmentRemovedEvent) {
            return;
        }

        $knowledge = $event->magicFlowKnowledgeEntity;
        $fragment = $event->magicFlowKnowledgeFragmentEntity;
        $magicFlowKnowledgeDomainService = $this->container->get(KnowledgeBaseDomainService::class);
        $knowledgeBaseFragmentDomainService = $this->container->get(KnowledgeBaseFragmentDomainService::class);
        $dataIsolation = KnowledgeBaseDataIsolation::create()->disabled();

        try {
            $existFragments = $knowledgeBaseFragmentDomainService->getFragmentsByPointId($dataIsolation, $fragment->getKnowledgeCode(), $fragment->getPointId(), true);
            if (! empty($existFragments) && $existFragments[0]->getVersion() <= $fragment->getVersion()) {
                // 删除相同内容的点
                $knowledge->getVectorDBDriver()->removePoints($knowledge->getCollectionName(), [$fragment->getPointId()]);
                $knowledgeBaseFragmentDomainService->batchDestroyByPointIds($dataIsolation, $knowledge, [$fragment->getPointId()]);
            }

            $fragment->setSyncStatus(KnowledgeSyncStatus::Deleted);
        } catch (Throwable $throwable) {
            $fragment->setSyncStatus(KnowledgeSyncStatus::DeleteFailed);
            $fragment->setSyncStatusMessage($throwable->getMessage());
        }
        $magicFlowKnowledgeDomainService->changeSyncStatus($fragment);
    }
}
