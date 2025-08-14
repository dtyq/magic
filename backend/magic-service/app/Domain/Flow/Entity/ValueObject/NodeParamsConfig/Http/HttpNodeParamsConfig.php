<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Http;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class HttpNodeParamsConfig extends NodeParamsConfig
{
    private Component $api;

    public function getApi(): Component
    {
        return $this->api;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();
        $apiComponent = ComponentFactory::fastCreate($params['api'] ?? [], lazy: true);
        if (! $apiComponent?->isApi()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'api']);
        }
        $this->api = $apiComponent;
        return [
            'api' => $apiComponent->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'api' => ComponentFactory::generateTemplate(StructureType::Api)?->jsonSerialize(),
        ]);
        $this->node->setInput(null);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $this->node->setOutput($output);

        $systemOutput = new NodeOutput();
        $systemOutput->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": null,
    "description": null,
    "required": [
        "response_body"
    ],
    "value": null,
    "items": null,
    "properties": {
        "response_body": {
            "type": "string",
            "key": "response_body",
            "sort": 0,
            "title": "原文输出",
            "description": "",
            "items": null,
            "properties": null,
            "required": null,
            "value": null
        }
    }
}
JSON,
            true
        )));
        $this->node->setSystemOutput($systemOutput);
    }
}
