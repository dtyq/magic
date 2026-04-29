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
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

use function di;

#[AsyncListener]
#[Listener]
readonly class KnowledgeBaseDocumentReSyncSubscriber implements ListenerInterface
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
        if ($event->create) {
            return;
        }

        /** @var LockerInterface $lock */
        $lock = di(LockerInterface::class);
        $documentEntity = $event->knowledgeBaseDocumentEntity;

        // 获取分布式锁
        $lockKey = "document_re_sync:{$documentEntity->getKnowledgeBaseCode()}:{$documentEntity->getCode()}";
        if (! $lock->mutexLock($lockKey, $event->knowledgeBaseDocumentEntity->getCreatedUid(), 300)) { // 5分钟超时
            $this->logger->info('文档[' . $documentEntity->getCode() . ']正在被其他进程处理，跳过同步');
            return;
        }

        try {
            $this->handle($event);
        } finally {
            $lock->release($lockKey, $event->knowledgeBaseDocumentEntity->getCreatedUid());
        }
    }

    private function handle(
        KnowledgeBaseDocumentSavedEvent $event
    ): void {
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
                'resync',
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
