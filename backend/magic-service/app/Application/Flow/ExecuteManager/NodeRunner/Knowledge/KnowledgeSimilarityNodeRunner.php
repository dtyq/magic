<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityFilter;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityManager;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\KnowledgeSimilarityNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

#[FlowNodeDefine(
    type: NodeType::KnowledgeSimilarity->value,
    code: NodeType::KnowledgeSimilarity->name,
    name: '向量数据库 / 向量搜索',
    paramsConfig: KnowledgeSimilarityNodeParamsConfig::class,
    version: 'v0',
    singleDebug: true,
    needInput: false,
    needOutput: true,
)]
class KnowledgeSimilarityNodeRunner extends AbstractKnowledgeNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var KnowledgeSimilarityNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $knowledgeCodes = $this->getKnowledgeCodesByVectorDatabaseIds($paramsConfig->getVectorDatabaseIds(), $executionData, $paramsConfig->getKnowledgeCodes());

        $paramsConfig->getQuery()?->getValue()?->getExpressionValue()?->setIsStringTemplate(true);
        $query = $paramsConfig->getQuery()?->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($query)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.knowledge_similarity.query_empty');
        }

        $metadataFilter = $paramsConfig->getMetadataFilter()?->getForm()->getKeyValue($executionData->getExpressionFieldData()) ?? [];

        $knowledgeSimilarity = new KnowledgeSimilarityFilter();
        $knowledgeSimilarity->setKnowledgeCodes($knowledgeCodes);
        $knowledgeSimilarity->setQuery($query);
        $knowledgeSimilarity->setLimit($paramsConfig->getLimit());
        $knowledgeSimilarity->setScore($paramsConfig->getScore());
        $knowledgeSimilarity->setMetadataFilter($metadataFilter);

        $dataIsolation = $executionData->getDataIsolation();
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::createByBaseDataIsolation($dataIsolation);
        $fragments = di(KnowledgeSimilarityManager::class)->similarity($knowledgeBaseDataIsolation, $knowledgeSimilarity);

        $similarityContents = [];
        $fragmentList = [];
        foreach ($fragments as $fragment) {
            $similarityContents[] = $fragment->getContent();
            $fragmentList[] = [
                'content' => $fragment->getContent(),
                'business_id' => $fragment->getBusinessId(),
                'metadata' => $fragment->getMetadata(),
            ];
        }

        $result = [
            'similarity_contents' => $similarityContents,
            'similarity_content' => implode("\n", $similarityContents),
            'fragments' => $fragmentList,
        ];

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}
