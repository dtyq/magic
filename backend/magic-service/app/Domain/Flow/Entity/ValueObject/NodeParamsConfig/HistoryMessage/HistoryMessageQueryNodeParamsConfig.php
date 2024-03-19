<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\HistoryMessage;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class HistoryMessageQueryNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();
        $maxRecord = $params['max_record'] ?? null;
        $min = 1;
        $max = 200;
        if (! is_numeric($maxRecord) || $maxRecord < $min || $maxRecord > $max) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.max_record.positive_integer', ['min' => $min, 'max' => $max]);
        }

        return [
            'max_record' => (int) $maxRecord,
            'start_time' => $params['start_time'] ?? '',
            'end_time' => $params['end_time'] ?? '',
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'max_record' => 10,
            'start_time' => '',
            'end_time' => '',
        ]);
        $this->node->setInput(null);
        $this->node->setOutput($this->getNodeOutput());
    }

    private function getNodeOutput(): NodeOutput
    {
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
        "history_messages"
    ],
    "properties": {
        "history_messages": {
            "type": "array",
            "key": "history_messages",
            "sort": 0,
            "title": "历史消息",
            "description": "",
            "items": {
                "type": "object",
                "key": "history_messages",
                "sort": 0,
                "title": "历史消息",
                "description": "",
                "items": null,
                "required": [
                    "role",
                    "content"
                ],
                "value": null,
                "properties": {
                    "role": {
                        "type": "string",
                        "key": "role",
                        "sort": 0,
                        "title": "角色",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "value": null
                    },
                    "content": {
                        "type": "string",
                        "key": "content",
                        "sort": 1,
                        "title": "内容",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "value": null
                    }
                }
            },
            "properties": null,
            "required": null,
            "value": null
        }
    }
}
JSON
        )));
        return $output;
    }
}
