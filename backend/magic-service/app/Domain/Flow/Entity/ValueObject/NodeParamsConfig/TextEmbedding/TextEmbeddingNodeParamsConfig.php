<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\TextEmbedding;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class TextEmbeddingNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();
        $embeddingModel = $params['embedding_model'] ?? '';
        if (empty($embeddingModel)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.model.empty');
        }
        $text = ComponentFactory::fastCreate($params['text'] ?? []);
        if (! $text?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'text']);
        }
        return [
            'embedding_model' => $embeddingModel,
            'text' => $text->jsonSerialize(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'embedding_model' => '',
            'text' => ComponentFactory::generateTemplate(StructureType::Value),
        ]);
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(<<<'JSON'
    {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "embeddings"
        ],
        "properties": {
            "embeddings": {
                "type": "array",
                "key": "embeddings",
                "sort": 0,
                "title": "向量",
                "description": "",
                "items": {
                    "type": "number",
                    "key": "0",
                    "sort": 0,
                    "title": "向量",
                    "description": "",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "value": null
                },
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON)));
        $this->node->setOutput($output);
    }
}
