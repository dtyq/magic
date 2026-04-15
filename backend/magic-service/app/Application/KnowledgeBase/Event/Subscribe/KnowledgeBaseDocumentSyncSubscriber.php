<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Application\KnowledgeBase\DTO\BusinessParamsDTO;
use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseDocumentSavedEvent;
use App\Domain\KnowledgeBase\Port\DocumentGateway;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

use function di;

#[AsyncListener]
#[Listener]
readonly class KnowledgeBaseDocumentSyncSubscriber implements ListenerInterface
{
    use HasLogger;

    public function __construct(
        private DocumentGateway $documentAppClient
    ) {
    }

    public function listen(): array
    {
        return [
            KnowledgeBaseDocumentSavedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof KnowledgeBaseDocumentSavedEvent) {
            return;
        }
        if (! $event->create) {
            return;
        }
        $knowledge = $event->knowledgeBaseEntity;
        $documentEntity = $event->knowledgeBaseDocumentEntity;
        $dataIsolation = $event->dataIsolation;
        // 如果是基础知识库类型，则传知识库创建者，避免权限不足
        if (in_array($knowledge->getType(), KnowledgeType::getAll())) {
            $dataIsolation->setCurrentUserId($knowledge->getCreator())->setCurrentOrganizationCode($knowledge->getOrganizationCode());
        }
        /** @var KnowledgeBaseDocumentDomainService $knowledgeBaseDocumentDomainService */
        $knowledgeBaseDocumentDomainService = di(KnowledgeBaseDocumentDomainService::class);
        try {
            $this->documentAppClient->sync(DocumentRequestDTO::forSync(
                $documentEntity->getCode(),
                $knowledge->getCode(),
                'create',
                new DataIsolationDTO(
                    organizationCode: (string) $dataIsolation->getCurrentOrganizationCode(),
                    userId: (string) $dataIsolation->getCurrentUserId(),
                ),
                new BusinessParamsDTO(
                    organizationCode: (string) $dataIsolation->getCurrentOrganizationCode(),
                    userId: (string) $dataIsolation->getCurrentUserId(),
                    businessId: $knowledge->getCode(),
                )
            ));
        } catch (Throwable $throwable) {
            $this->logger->error($throwable->getMessage() . PHP_EOL . $throwable->getTraceAsString());
            $documentEntity->setSyncStatus(KnowledgeSyncStatus::SyncFailed->value);
            $documentEntity->setSyncStatusMessage($throwable->getMessage());
            $knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
        }
    }
}
