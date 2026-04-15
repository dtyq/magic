<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\KnowledgeBase\Service\KnowledgeBaseFragmentAppService;
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

        $dataIsolation = $executionData->getDataIsolation();
        $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::createByBaseDataIsolation($dataIsolation);
        $response = di(KnowledgeBaseFragmentAppService::class)->runtimeSimilarityByDataIsolation(
            $knowledgeBaseDataIsolation,
            $knowledgeCodes,
            $query,
            '',
            (int) $paramsConfig->getLimit(),
            (float) $paramsConfig->getScore(),
            $metadataFilter,
        );
        $fragments = is_array($response['list'] ?? null) ? $response['list'] : $response;

        $similarityContents = [];
        $fragmentList = [];
        foreach ($fragments as $fragment) {
            $content = (string) ($fragment['content'] ?? '');
            $similarityContents[] = $content;
            $fragmentList[] = [
                'content' => $content,
                'business_id' => (string) ($fragment['business_id'] ?? ''),
                'metadata' => is_array($fragment['metadata'] ?? null) ? $fragment['metadata'] : [],
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
