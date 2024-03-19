<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Domain\Flow\Entity\ValueObject\Query\KnowledgeBaseDocumentQuery;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseDocumentSavedEvent;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreDriver;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Qbhy\HyperfAuth\Authenticatable;

class KnowledgeBaseDocumentAppService extends AbstractKnowledgeAppService
{
    /**
     * @return array<string, int> array<知识库code, 文档数量>
     */
    public function getDocumentCountByKnowledgeBaseCodes(Authenticatable $authorization, array $knowledgeBaseCodes): array
    {
        return $this->knowledgeBaseDocumentDomainService->getDocumentCountByKnowledgeBaseCodes($this->createKnowledgeBaseDataIsolation($authorization), $knowledgeBaseCodes);
    }

    /**
     * 保存知识库文档.
     */
    public function save(Authenticatable $authorization, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'w', $documentEntity->getKnowledgeBaseCode(), $documentEntity->getCode());
        $documentEntity->setCreatedUid($dataIsolation->getCurrentUserId());
        $documentEntity->setUpdatedUid($dataIsolation->getCurrentUserId());
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $documentEntity->getKnowledgeBaseCode());

        // 文档配置继承知识库(如果没有对应设置)
        empty($knowledgeBaseEntity->getFragmentConfig()) && $documentEntity->setFragmentConfig($knowledgeBaseEntity->getFragmentConfig());
        empty($documentEntity->getRetrieveConfig()) && $documentEntity->setRetrieveConfig($knowledgeBaseEntity->getRetrieveConfig());

        // 嵌入配置不可编辑
        $documentEntity->setEmbeddingConfig($knowledgeBaseEntity->getEmbeddingConfig());
        // 设置默认的嵌入模型和向量数据库
        $documentEntity->setEmbeddingModel($knowledgeBaseEntity->getModel());
        $documentEntity->setVectorDb(VectorStoreDriver::default()->value);
        if (! $documentEntity->getCode()) {
            // 新建文档
            if ($documentEntity->getDocumentFile()) {
                $documentFile = $this->documentFileStrategy->preProcessDocumentFile($dataIsolation, $documentEntity->getDocumentFile());
                $documentEntity->setDocumentFile($documentFile);
            }
            return $this->knowledgeBaseDocumentDomainService->create($dataIsolation, $knowledgeBaseEntity, $documentEntity);
        }
        return $this->knowledgeBaseDocumentDomainService->update($dataIsolation, $knowledgeBaseEntity, $documentEntity);
    }

    /**
     * 查询知识库文档列表.
     *
     * @return array{total: int, list: array<KnowledgeBaseDocumentEntity>}
     */
    public function query(Authenticatable $authorization, KnowledgeBaseDocumentQuery $query, Page $page): array
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);

        // 验证知识库的权限
        $this->checkKnowledgeBaseOperation($dataIsolation, 'r', $query->getKnowledgeBaseCode(), $query->getCode());

        // 兼容旧数据，新增默认文档
        $fragmentQuery = new KnowledgeBaseFragmentQuery();
        $fragmentQuery->setKnowledgeCode($query->getKnowledgeBaseCode());
        $fragmentQuery->setIsDefaultDocumentCode(true);
        $fragmentEntities = $this->knowledgeBaseFragmentDomainService->queries($dataIsolation, $fragmentQuery, new Page(1, 1));
        if (! empty($fragmentEntities['list'])) {
            $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $query->getKnowledgeBaseCode());
            $this->knowledgeBaseStrategy->getOrCreateDefaultDocument($dataIsolation, $knowledgeBaseEntity);
        }

        // 调用领域服务查询文档
        $entities = $this->knowledgeBaseDocumentDomainService->queries($dataIsolation, $query, $page);
        $documentCodeFinalSyncStatusMap = $this->knowledgeBaseFragmentDomainService->getFinalSyncStatusByDocumentCodes(
            $dataIsolation,
            array_map(fn ($entity) => $entity->getCode(), $entities['list'])
        );
        // 获取文档同步状态
        foreach ($entities['list'] as $entity) {
            if (isset($documentCodeFinalSyncStatusMap[$entity->getCode()])) {
                $entity->setSyncStatus($documentCodeFinalSyncStatusMap[$entity->getCode()]->value);
            }
        }
        return $entities;
    }

    public function reVectorizedByThirdFileId(Authenticatable $authorization, string $thirdPlatformType, string $thirdFileId): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $documents = $this->knowledgeBaseDocumentDomainService->getByThirdFileId($dataIsolation, $thirdPlatformType, $thirdFileId);
        $knowledgeEntities = $this->knowledgeBaseDomainService->getByCodes($dataIsolation, array_column($documents, 'knowledge_base_code'));
        /** @var array<string, KnowledgeBaseEntity> $knowledgeEntities */
        $knowledgeEntities = array_column($knowledgeEntities, null, 'code');

        foreach ($documents as $document) {
            $knowledgeEntity = $knowledgeEntities[$document['knowledge_base_code']] ?? null;
            if ($knowledgeEntity && $knowledgeEntity->getType() === KnowledgeType::UserKnowledgeBase->value) {
                $event = new KnowledgeBaseDocumentSavedEvent($dataIsolation, $knowledgeEntity, $document, false);
                AsyncEventUtil::dispatch($event);
            }
        }
    }

    /**
     * 查看单个知识库文档详情.
     */
    public function show(Authenticatable $authorization, string $knowledgeBaseCode, string $documentCode): KnowledgeBaseDocumentEntity
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'r', $knowledgeBaseCode, $documentCode);

        // 获取文档
        $entity = $this->knowledgeBaseDocumentDomainService->show($dataIsolation, $knowledgeBaseCode, $documentCode);
        $documentCodeFinalSyncStatusMap = $this->knowledgeBaseFragmentDomainService->getFinalSyncStatusByDocumentCodes($dataIsolation, [$documentCode]);
        isset($documentCodeFinalSyncStatusMap[$documentCode]) && $entity->setSyncStatus($documentCodeFinalSyncStatusMap[$documentCode]->value);
        return $entity;
    }

    /**
     * 删除知识库文档.
     */
    public function destroy(Authenticatable $authorization, string $knowledgeBaseCode, string $documentCode): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'del', $knowledgeBaseCode, $documentCode);
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $knowledgeBaseCode);

        // 调用领域服务删除文档
        $this->knowledgeBaseDocumentDomainService->destroy($dataIsolation, $knowledgeBaseEntity, $documentCode);
    }

    /**
     * 重新向量化.
     */
    public function reVectorized(Authenticatable $authorization, string $knowledgeBaseCode, string $documentCode): void
    {
        $dataIsolation = $this->createKnowledgeBaseDataIsolation($authorization);
        $this->checkKnowledgeBaseOperation($dataIsolation, 'manage', $knowledgeBaseCode, $documentCode);

        // 调用领域服务重新向量化
        $knowledgeBaseEntity = $this->knowledgeBaseDomainService->show($dataIsolation, $knowledgeBaseCode);
        $documentEntity = $this->knowledgeBaseDocumentDomainService->show($dataIsolation, $knowledgeBaseCode, $documentCode);
        // 由于历史文档没有 document_file 字段，不能被重新向量化
        if (! $documentEntity->getDocumentFile()) {
            ExceptionBuilder::throw(PermissionErrorCode::Error, 'flow.knowledge_base.re_vectorized_not_support');
        }
        // 分发事件，重新向量化
        $documentSavedEvent = new KnowledgeBaseDocumentSavedEvent(
            $dataIsolation,
            $knowledgeBaseEntity,
            $documentEntity,
            false,
        );
        AsyncEventUtil::dispatch($documentSavedEvent);
    }
}
