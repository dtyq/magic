<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class VariableArrayPushNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();

        $inputFields = ComponentFactory::fastCreate($params['variable']['form'] ?? null);
        if (! $inputFields?->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'variable']);
        }

        $result = $inputFields->getForm()->getKeyValue(check: true, execExpression: false);
        if (! array_key_exists('variable_name', $result)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.variable.name_empty');
        }
        if (! array_key_exists('element_list', $result)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.variable.element_list_empty');
        }
        if (! is_null($result['variable_name'])) {
            VariableValidate::checkName($result['variable_name']);
        }

        return [
            'variable' => [
                'form' => $inputFields->jsonSerialize(),
                'page' => $params['variable']['page'] ?? null,
            ],
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'variable' => [
                'form' => ComponentFactory::generateTemplate(StructureType::Form, Json::decode(<<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": null,
    "required": [
        "variable_name"
    ],
    "value": null,
    "items": null,
    "properties": {
        "variable_name": {
            "type": "string",
            "key": "variable_name",
            "sort": 0,
            "title": "变量名",
            "description": "",
            "required": null,
            "value": null,
            "items": null,
            "properties": null
        }
    }
}
JSON))->jsonSerialize(),
                'page' => null,
            ],
        ]);
    }
}
