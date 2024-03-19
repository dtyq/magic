<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\KnowledgeFragmentStoreNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

#[FlowNodeDefine(
    type: NodeType::KnowledgeFragmentStore->value,
    code: NodeType::KnowledgeFragmentStore->name,
    name: '向量数据库 / 向量存储',
    paramsConfig: KnowledgeFragmentStoreNodeParamsConfig::class,
    version: 'v0',
    singleDebug: true,
    needInput: false,
    needOutput: false,
)]
class KnowledgeFragmentStoreNodeRunner extends AbstractKnowledgeNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var KnowledgeFragmentStoreNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $knowledgeCode = $this->getKnowledgeCodeByVectorDatabaseId($paramsConfig->getVectorDatabaseId(), $executionData, $paramsConfig->getKnowledgeCode());

        $paramsConfig->getContent()?->getValue()?->getExpressionValue()?->setIsStringTemplate(true);

        $content = $paramsConfig->getContent()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? null;
        if (! is_string($content) || $content === '') {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge_fragment_store.content_empty');
        }

        $metadata = $paramsConfig->getMetadata()?->getForm()?->getKeyValue($executionData->getExpressionFieldData()) ?? [];

        $paramsConfig->getBusinessId()?->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $businessId = $paramsConfig->getBusinessId()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? '';
        if (! is_string($businessId)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge_fragment_store.business_id_empty');
        }

        $knowledgeBaseDomainService = di(KnowledgeBaseDomainService::class);
        $documentDomainService = di(KnowledgeBaseDocumentDomainService::class);
        $fragmentDomainService = di(KnowledgeBaseFragmentDomainService::class);
        $dataIsolation = $executionData->getDataIsolation();
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $dataIsolation->getMagicId());
        $knowledgeBaseEntity = $knowledgeBaseDomainService->show($knowledgeBaseDataIsolation, $knowledgeCode);
        // 这里要建立一个归纳的文档
        $documentEntity = $documentDomainService->getOrCreateDefaultDocument($knowledgeBaseDataIsolation, $knowledgeBaseEntity);

        $savingMagicFlowKnowledgeFragmentEntity = new KnowledgeBaseFragmentEntity();
        $savingMagicFlowKnowledgeFragmentEntity->setKnowledgeCode($knowledgeCode);
        $savingMagicFlowKnowledgeFragmentEntity->setDocumentCode($documentEntity->getCode());
        $savingMagicFlowKnowledgeFragmentEntity->setContent($content);
        $savingMagicFlowKnowledgeFragmentEntity->setMetadata($metadata);
        $savingMagicFlowKnowledgeFragmentEntity->setBusinessId($businessId);
        $savingMagicFlowKnowledgeFragmentEntity->setCreator($executionData->getOperator()->getUid());
        $savingMagicFlowKnowledgeFragmentEntity->setCreatedAt(new DateTime());

        $fragmentDomainService->save($knowledgeBaseDataIsolation, $knowledgeBaseEntity, $documentEntity, $savingMagicFlowKnowledgeFragmentEntity);
    }
}
