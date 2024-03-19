<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Variable;

use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class VariableArrayPushNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::VariableArrayPush, json_decode(<<<'JSON'
{
    "variable": {
        "form": {
            "id": "component-66e0f7e327921",
            "version": "1",
            "type": "form",
            "structure": {
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
                        "value": {
                            "type": "expression",
                            "const_value": null,
                            "expression_value": [
                                {
                                    "type": "fields",
                                    "value": "9527.var1",
                                    "name": "9527.var1",
                                    "args": null
                                }
                            ]
                        },
                        "items": null,
                        "properties": null
                    },
                    "element_list": {
                        "type": "string",
                        "key": "element_list",
                        "sort": 1,
                        "title": "值",
                        "description": "",
                        "required": null,
                        "value": {
                            "type": "expression",
                            "const_value": null,
                            "expression_value": [
                                {
                                    "type": "fields",
                                    "value": "9527.element_list",
                                    "name": "9527.element_list",
                                    "args": null
                                }
                            ]
                        },
                        "items": null,
                        "properties": null
                    }
                }
            }
        },
        "page": null
    }
}
JSON, true));

        $node->validate();

        $runner = MagicFlowExecutor::getNodeRunner($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->variableSave('var1', ['value777', 'value888']);
        $executionData->saveNodeContext('9527', [
            'var1' => 'var1',
            'element_list' => 'value999',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals([
            'var1' => ['value777', 'value888', 'value999'],
        ], $executionData->getVariables());
    }
}
