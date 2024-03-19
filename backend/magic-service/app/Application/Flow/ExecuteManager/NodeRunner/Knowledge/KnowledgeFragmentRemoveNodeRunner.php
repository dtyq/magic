<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityFilter;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityManager;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\KnowledgeFragmentRemoveNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

#[FlowNodeDefine(
    type: NodeType::KnowledgeFragmentRemove->value,
    code: NodeType::KnowledgeFragmentRemove->name,
    name: '向量数据库 / 向量删除',
    paramsConfig: KnowledgeFragmentRemoveNodeParamsConfig::class,
    version: 'v0',
    singleDebug: true,
    needInput: false,
    needOutput: false,
)]
class KnowledgeFragmentRemoveNodeRunner extends AbstractKnowledgeNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var KnowledgeFragmentRemoveNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $knowledgeCode = $this->getKnowledgeCodeByVectorDatabaseId($paramsConfig->getVectorDatabaseId(), $executionData, $paramsConfig->getKnowledgeCode());

        $metadataFilter = $paramsConfig->getMetadataFilter()?->getForm()->getKeyValue($executionData->getExpressionFieldData()) ?? [];

        $paramsConfig->getBusinessId()?->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $businessId = $paramsConfig->getBusinessId()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? '';
        if (! is_string($businessId)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge_fragment_store.business_id_empty');
        }

        // metadata 或者 business_id 必须有一个不为空
        if (empty($metadataFilter) && empty($businessId)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge_fragment_remove.metadata_business_id_empty');
        }

        $knowledgeDomainService = di(KnowledgeBaseDomainService::class);
        $fragmentDomainService = di(KnowledgeBaseFragmentDomainService::class);
        $dataIsolation = $executionData->getDataIsolation();
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::createByBaseDataIsolation($dataIsolation);
        $KnowledgeEntity = $knowledgeDomainService->show($knowledgeBaseDataIsolation, $knowledgeCode);

        if (! empty($businessId)) {
            // 优先级高
            $fragment = $fragmentDomainService->showByBusinessId(
                $knowledgeBaseDataIsolation,
                $knowledgeCode,
                $businessId
            );
            $fragmentDomainService->destroy($knowledgeBaseDataIsolation, $KnowledgeEntity, $fragment);
            return;
        }
        $filter = new KnowledgeSimilarityFilter();
        $filter->setKnowledgeCodes([$knowledgeCode]);
        $filter->setMetadataFilter($metadataFilter);

        di(KnowledgeSimilarityManager::class)->destroyByMetadataFilter($knowledgeBaseDataIsolation, $KnowledgeEntity, $filter);
    }
}
