<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Variable;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable\VariableSetNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Variable\VariableValidate;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use Dtyq\FlowExprEngine\ComponentFactory;

#[FlowNodeDefine(
    type: NodeType::VariableSet->value,
    code: NodeType::VariableSet->name,
    name: '变量 / 数据存储',
    paramsConfig: VariableSetNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: false,
)]
class VariableSetNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $params = $this->node->getParams();

        $variablesComponent = ComponentFactory::fastCreate($params['variables']['form'] ?? []);
        $variables = $variablesComponent->getForm()->getKeyValue($executionData->getExpressionFieldData());
        foreach ($variables as $variableKey => $variableValue) {
            $variableKey = (string) $variableKey;
            VariableValidate::checkName($variableKey);
            $executionData->variableSave($variableKey, $variableValue);
        }

        $result = [
            'variables' => $variables,
        ];

        $executionData->saveNodeContext($this->node->getNodeId(), $result);
        $vertexResult->setResult($result);
    }
}
