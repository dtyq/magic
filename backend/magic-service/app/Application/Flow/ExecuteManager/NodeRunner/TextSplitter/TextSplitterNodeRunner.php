<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\TextSplitter;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\TextSplitter\TextSplitterNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Embeddings\DocumentSplitter\DocumentSplitterSwitch;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGenerator;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;

#[FlowNodeDefine(
    type: NodeType::TextSplitter->value,
    code: NodeType::TextSplitter->name,
    name: '文本切割',
    paramsConfig: TextSplitterNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true,
)]
class TextSplitterNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $params = $this->node->getParams();

        $content = ComponentFactory::fastCreate($params['content'] ?? []);
        if (! $content || ! $content->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.component.format_error', ['label' => 'content']);
        }
        $content->getValue()->getExpressionValue()?->setIsStringTemplate(true);
        $text = $content->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($text)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.text_splitter.empty_text');
        }

        $splitter = DocumentSplitterSwitch::tryFrom($params['strategy'] ?? '') ?? DocumentSplitterSwitch::Auto;
        $model = $this->modelGatewayMapper->getChatModelProxy($executionData->getDataIsolation(), EmbeddingGenerator::defaultModel());

        $splitTexts = $splitter->getSplitter()->split($model, $text);

        $result = [
            'split_texts' => $splitTexts,
        ];

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}
