<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Application\KnowledgeBase\Service\KnowledgeBaseVectorAppService;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseDocumentSavedEvent;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function di;

#[AsyncListener]
#[Listener]
readonly class KnowledgeBaseDocumentReSyncSubscriber implements ListenerInterface
{
    public function __construct()
    {
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
        /** @var LoggerInterface $logger */
        $logger = di(LoggerInterface::class);

        // 获取分布式锁
        $lockKey = "document_re_sync:{$documentEntity->getKnowledgeBaseCode()}:{$documentEntity->getCode()}";
        if (! $lock->mutexLock($lockKey, $event->knowledgeBaseDocumentEntity->getCreatedUid(), 300)) { // 5分钟超时
            $logger->info('文档[' . $documentEntity->getCode() . ']正在被其他进程处理，跳过同步');
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
        /** @var LoggerInterface $logger */
        $logger = di(LoggerInterface::class);
        /** @var KnowledgeBaseVectorAppService $knowledgeBaseVectorAppService */
        $knowledgeBaseVectorAppService = di(KnowledgeBaseVectorAppService::class);

        // 自增版本号(抢锁)
        $affectedRows = $knowledgeBaseDocumentDomainService->increaseVersion($dataIsolation, $documentEntity);
        // 如果自增失败，说明已经重新向量化过了，提前结束
        if ($affectedRows === 0) {
            $logger->info('文档已重新向量化，跳过同步');
            return;
        }

        // 检查配置
        try {
            $knowledgeBaseVectorAppService->checkCollectionExists($knowledge);
        } catch (Throwable $throwable) {
            $logger->error($throwable->getMessage() . PHP_EOL . $throwable->getTraceAsString());
            $documentEntity->setSyncStatus(KnowledgeSyncStatus::SyncFailed->value);
            $documentEntity->setSyncStatusMessage($throwable->getMessage());
            $knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
            return;
        }

        // 销毁旧分段
        try {
            $knowledgeBaseVectorAppService->destroyOldFragments($dataIsolation, $knowledge, $documentEntity);
        } catch (Throwable $throwable) {
            $logger->error($throwable->getMessage() . PHP_EOL . $throwable->getTraceAsString());
            $documentEntity->setSyncStatus(KnowledgeSyncStatus::DeleteFailed->value);
            $documentEntity->setSyncStatusMessage($throwable->getMessage());
            $knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
            return;
        }

        // 同步文档
        try {
            $documentEntity->setVersion($documentEntity->getVersion() + 1);
            $knowledgeBaseVectorAppService->syncDocument($dataIsolation, $knowledge, $documentEntity);
        } catch (Throwable $throwable) {
            $logger->error($throwable->getMessage() . PHP_EOL . $throwable->getTraceAsString());
            $documentEntity->setSyncStatus(KnowledgeSyncStatus::SyncFailed->value);
            $documentEntity->setSyncStatusMessage($throwable->getMessage());
            $knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
        }
    }
}
