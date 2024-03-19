<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\TextSplitter;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class TextSplitterNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();

        $content = ComponentFactory::fastCreate($params['content'] ?? []);
        if (! $content?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'content']);
        }

        return [
            'strategy' => $params['strategy'] ?? '',
            'content' => $content->jsonSerialize(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'strategy' => '',
            'content' => ComponentFactory::generateTemplate(StructureType::Value),
        ]);
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(
            <<<'JSON'
    {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "split_texts"
        ],
        "properties": {
            "split_texts": {
                "type": "array",
                "key": "split_texts",
                "sort": 0,
                "title": "文本片段",
                "description": "",
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "文本片段",
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
JSON
        )));
        $this->node->setOutput($output);
    }
}
