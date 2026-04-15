<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\KnowledgeBase\Service\KnowledgeBaseFragmentAppService;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\KnowledgeFragmentStoreNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

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

        $dataIsolation = $executionData->getDataIsolation();
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $dataIsolation->getMagicId());
        di(KnowledgeBaseFragmentAppService::class)->runtimeCreateByDataIsolation(
            $knowledgeBaseDataIsolation,
            $knowledgeCode,
            $content,
            $metadata,
            $businessId,
        );
    }
}
