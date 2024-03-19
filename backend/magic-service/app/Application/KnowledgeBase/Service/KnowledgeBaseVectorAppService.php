<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Throwable;

class KnowledgeBaseVectorAppService extends AbstractKnowledgeAppService
{
    /**
     * 检查知识库的向量集合是否存在.
     *
     * @throws BusinessException
     */
    public function checkCollectionExists(KnowledgeBaseEntity $knowledgeBaseEntity): bool
    {
        $vector = $knowledgeBaseEntity->getVectorDBDriver();
        $collection = $vector->getCollection($knowledgeBaseEntity->getCollectionName());
        if (! $collection) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'collection不存在');
        }
        return true;
    }

    /**
     * 销毁旧分段.
     */
    public function destroyOldFragments(
        KnowledgeBaseDataIsolation $dataIsolation,
        KnowledgeBaseEntity $knowledge,
        KnowledgeBaseDocumentEntity $documentEntity
    ): bool {
        try {
            // 先获取所有分段
            $fragmentQuery = new KnowledgeBaseFragmentQuery();
            $fragmentQuery->setKnowledgeCode($knowledge->getCode());
            $fragmentQuery->setDocumentCode($documentEntity->getCode());
            $fragmentQuery->setVersion($documentEntity->getVersion());
            $fragmentEntities = [];
            $page = new Page(1, 1);
            while (true) {
                $currentFragmentEntities = $this->knowledgeBaseFragmentDomainService->queries($dataIsolation, $fragmentQuery, $page)['list'];
                if (empty($currentFragmentEntities)) {
                    break;
                }
                $fragmentEntities[] = $currentFragmentEntities;
                $page->setNextPage();
            }
            /**
             * @var array<KnowledgeBaseFragmentEntity> $fragmentEntities
             */
            $fragmentEntities = array_merge(...$fragmentEntities);

            // 再删除片段
            foreach ($fragmentEntities as $fragmentEntity) {
                $this->knowledgeBaseFragmentDomainService->destroy($dataIsolation, $knowledge, $fragmentEntity);
            }
            $documentEntity->setSyncStatus(KnowledgeSyncStatus::Deleted->value);
            $this->knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
            return true;
        } catch (Throwable $throwable) {
            $this->logger->error($throwable->getMessage() . PHP_EOL . $throwable->getTraceAsString());
            $documentEntity->setSyncStatus(KnowledgeSyncStatus::DeleteFailed->value);
            $documentEntity->setSyncStatusMessage($throwable->getMessage());
            $this->knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
            return false;
        }
    }

    public function syncDocument(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $knowledgeBaseEntity, KnowledgeBaseDocumentEntity $documentEntity): void
    {
        $documentFile = $documentEntity->getDocumentFile();
        if (! $documentFile) {
            return;
        }

        $documentEntity->setSyncStatus(KnowledgeSyncStatus::Syncing->value);
        $this->knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
        $this->logger->info('正在解析文件，文件名：' . $documentFile->getName());
        $content = $this->documentFileStrategy->parseContent($dataIsolation, $documentFile, $knowledgeBaseEntity->getCode());
        $this->logger->info('解析文件完成，正在文件分段，文件名：' . $documentFile->getName());
        $splitText = $this->knowledgeBaseFragmentDomainService->processFragmentsByContent($dataIsolation, $content, $documentEntity->getFragmentConfig());
        $this->logger->info('文件分段完成，文件名：' . $documentFile->getName() . '，分段数量:' . count($splitText));

        foreach ($splitText as $text) {
            $fragmentEntity = (new KnowledgeBaseFragmentEntity())
                ->setKnowledgeCode($knowledgeBaseEntity->getCode())
                ->setDocumentCode($documentEntity->getCode())
                ->setContent($text)
                ->setCreator($documentEntity->getCreatedUid())
                ->setModifier($documentEntity->getUpdatedUid())
                ->setVersion($documentEntity->getVersion());
            $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $fragmentEntity->getKnowledgeCode());
            $this->knowledgeBaseFragmentDomainService->save($dataIsolation, $knowledgeBaseEntity, $documentEntity, $fragmentEntity);
        }
        $documentEntity->setSyncStatus(KnowledgeSyncStatus::Synced->value);
        $this->knowledgeBaseDocumentDomainService->changeSyncStatus($dataIsolation, $documentEntity);
    }
}
