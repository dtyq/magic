<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\TextEmbedding;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\TextEmbedding\TextEmbeddingNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Hyperf\Context\ApplicationContext;

#[FlowNodeDefine(
    type: NodeType::TextEmbedding->value,
    code: NodeType::TextEmbedding->name,
    name: '文本嵌入',
    paramsConfig: TextEmbeddingNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: false,
)]
class TextEmbeddingNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $params = $this->node->getParams();

        $modelName = $this->getModelName('embedding_model', $executionData);

        $text = ComponentFactory::fastCreate($params['text'] ?? []);
        if (! $text?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.component.format_error', ['label' => 'text']);
        }
        $text->getValue()->getExpressionValue()->setIsStringTemplate(true);
        $input = $text->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($input)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.text_embedding.empty_text');
        }
        $embeddingModel = $this->modelGatewayMapper->getEmbeddingModelProxy($executionData->getDataIsolation(), $modelName);

        $embeddingGenerator = ApplicationContext::getContainer()->get(EmbeddingGeneratorInterface::class);

        $result = [
            'embeddings' => $embeddingGenerator->embedText($embeddingModel, $input, options: [
                'organization_id' => $executionData->getDataIsolation()->getCurrentOrganizationCode(),
                'user_id' => $executionData->getDataIsolation()->getCurrentUserId(),
                'business_id' => $executionData->getFlowCode(),
                'source_id' => 'text_embedding_node',
            ]),
        ];
        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}
