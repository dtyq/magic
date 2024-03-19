<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Variable;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable\VariableArrayShiftNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable\VariableValidate;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;

#[FlowNodeDefine(
    type: NodeType::VariableArrayShift->value,
    code: NodeType::VariableArrayShift->name,
    name: '变量 / 数组头部取值',
    paramsConfig: VariableArrayShiftNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true,
)]
class VariableArrayShiftNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $params = $this->node->getParams();
        $inputFields = ComponentFactory::fastCreate($params['variable']['form'] ?? []);
        if (! $inputFields?->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.component.format_error', ['label' => 'variable']);
        }

        $result = $inputFields->getForm()->getKeyValue($executionData->getExpressionFieldData());
        $variableName = $result['variable_name'] ?? '';
        VariableValidate::checkName($variableName);
        $variable = $executionData->variableGet($variableName);
        if (is_null($variable)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.variable.variable_not_exist', ['var_name' => $variableName]);
        }
        if (! is_array($variable)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.variable.variable_not_array', ['var_name' => $variableName]);
        }

        $value = $executionData->variableShift($result['variable_name']);

        $result = [
            'value' => $value,
        ];

        $executionData->saveNodeContext($this->node->getNodeId(), $result);
        $vertexResult->setResult($result);
    }
}
