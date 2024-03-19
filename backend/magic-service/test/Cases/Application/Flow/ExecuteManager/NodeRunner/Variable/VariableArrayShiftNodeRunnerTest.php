<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Variable;

use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class VariableArrayShiftNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::VariableArrayShift, json_decode(<<<'JSON'
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
                    }
                }
            }
        },
        "page": null
    }
}
JSON, true));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-66e0f7e327fbd",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": null,
        "required": [
            "value"
        ],
        "value": null,
        "items": null,
        "properties": {
            "value": {
                "type": "string",
                "key": "value",
                "sort": 0,
                "title": "值",
                "description": "",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)));
        $node->setOutput($output);

        $node->validate();

        $runner = MagicFlowExecutor::getNodeRunner($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->variableSave('var1', ['value777', 'value888']);
        $executionData->saveNodeContext('9527', [
            'var1' => 'var1',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals([
            'var1' => ['value888'],
        ], $executionData->getVariables());
        $this->assertEquals([
            'value' => 'value777',
        ], $executionData->getNodeContext($node->getNodeId()));
    }
}
