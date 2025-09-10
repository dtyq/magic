<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseDocumentRemovedEvent;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;
use Throwable;

use function di;

#[Listener]
readonly class KnowledgeBaseDocumentDestroySubscriber implements ListenerInterface
{
    public function __construct(private ContainerInterface $container)
    {
    }

    public function listen(): array
    {
        return [
            KnowledgeBaseDocumentRemovedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof KnowledgeBaseDocumentRemovedEvent) {
            return;
        }
        $knowledge = $event->knowledgeBaseEntity;
        $document = $event->knowledgeBaseDocumentEntity;
        $dataIsolation = $event->dataIsolation;
        // 如果是基础知识库类型，则传知识库创建者，避免权限不足
        if (in_array($knowledge->getType(), KnowledgeType::getAll())) {
            $dataIsolation->setCurrentUserId($knowledge->getCreator())->setCurrentOrganizationCode($knowledge->getOrganizationCode());
        }
        /** @var KnowledgeBaseDomainService $knowledgeBaseDomainService */
        $knowledgeBaseDomainService = di()->get(KnowledgeBaseDomainService::class);
        /** @var KnowledgeBaseFragmentDomainService $knowledgeBaseFragmentDomainService */
        $knowledgeBaseFragmentDomainService = di()->get(KnowledgeBaseFragmentDomainService::class);
        /** @var KnowledgeBaseDocumentDomainService $documentDomainService */
        $documentDomainService = $this->container->get(KnowledgeBaseDocumentDomainService::class);

        $knowledgeBaseEntity = $knowledgeBaseDomainService->show($dataIsolation, $document->getKnowledgeBaseCode());

        // 这里需要删除所有片段，在删除文档
        $query = new KnowledgeBaseFragmentQuery()->setDocumentCode($document->getCode());
        /** @var KnowledgeBaseFragmentEntity[][] $fragments */
        $fragments = [];
        $page = 1;
        while (true) {
            $queryResult = $knowledgeBaseFragmentDomainService->queries($dataIsolation, $query, new Page($page, 100));
            if (empty($queryResult['list'])) {
                break;
            }
            $fragments[] = $queryResult['list'];
            ++$page;
        }
        /** @var KnowledgeBaseFragmentEntity[] $fragments */
        $fragments = array_merge(...$fragments);
        $documentSyncStatus = KnowledgeSyncStatus::Deleted;
        // 先删除片段
        $pointIds = array_column($fragments, 'point_id');
        $fragmentSyncStatus = KnowledgeSyncStatus::Deleted;
        $fragmentSyncMessage = '';
        try {
            $knowledgeBaseEntity->getVectorDBDriver()->removePoints($knowledgeBaseEntity->getCollectionName(), $pointIds);
            $knowledgeBaseFragmentDomainService->batchDestroyByPointIds($dataIsolation, $knowledgeBaseEntity, $pointIds);
        } catch (Throwable $throwable) {
            foreach ($fragments as $fragment) {
                $fragmentSyncStatus = KnowledgeSyncStatus::DeleteFailed;
                $fragmentSyncMessage = $throwable->getMessage();
            }
            $documentSyncStatus = KnowledgeSyncStatus::DeleteFailed;
        }
        $knowledgeBaseFragmentDomainService->batchChangeSyncStatus(array_column($fragments, 'id'), $fragmentSyncStatus, $fragmentSyncMessage);

        // 删除片段完成后，将文档同步标记为已删除
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::createByBaseDataIsolation($dataIsolation);
        $documentDomainService->changeSyncStatus($knowledgeBaseDataIsolation, $document->setSyncStatus($documentSyncStatus->value));
    }
}
