<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\If;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class IfNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::If, json_decode(<<<'JSON'
{
    "max_execute_num": 3,
    "branches": [
        {
            "branch_id": "234",
            "next_nodes": [
                "1",
                "2"
            ],
            "branch_type": "if",
            "parameters": {
                "id": "component-234",
                "version": "1",
                "type": "condition",
                "structure": {
                    "ops": "AND",
                    "children": [
                        {
                            "type": "compare",
                            "left_operands": {
                                "type": "expression",
                                "const_value": null,
                                "expression_value": [
                                    {
                                        "type": "fields",
                                        "value": "9527.xxx",
                                        "trans": "toNumber()",
                                        "name": "1",
                                        "args": null
                                    }
                                ]
                            },
                            "condition": "equals",
                            "right_operands": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "'123'",
                                        "name": "123",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        }
                    ]
                }
            }
        },
        {
            "branch_id": "234",
            "next_nodes": [
                "3"
            ],
            "branch_type": "else",
            "parameters": null
        }
    ]
}
JSON, true));
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'xxx' => 123,
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['1', '2'], $vertexResult->getChildrenIds());

        $vertexResult = new VertexResult();
        $executionData->saveNodeContext('9527', [
            'xxx' => 456,
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['3'], $vertexResult->getChildrenIds());
    }

    public function testRunEmpty()
    {
        $node = Node::generateTemplate(NodeType::If, json_decode(<<<'JSON'
{
    "max_execute_num": 3,
    "branches": [
        {
            "branch_id": "234",
            "next_nodes": [
                "1",
                "2"
            ],
            "branch_type": "if",
            "parameters": {
                "id": "component-234",
                "version": "1",
                "type": "condition",
                "structure": {
                    "ops": "AND",
                    "children": [
                        {
                            "type": "compare",
                            "left_operands": {
                                "type": "expression",
                                "const_value": null,
                                "expression_value": [
                                    {
                                        "type": "fields",
                                        "value": "9527.xxx",
                                        "name": "1",
                                        "args": null
                                    }
                                ]
                            },
                            "condition": "empty",
                            "right_operands": null
                        }
                    ]
                }
            }
        },
        {
            "branch_id": "234",
            "next_nodes": [
                "3"
            ],
            "branch_type": "else",
            "parameters": null
        }
    ]
}
JSON, true));
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'xxx' => [],
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['1', '2'], $vertexResult->getChildrenIds());

        $vertexResult = new VertexResult();
        $executionData->saveNodeContext('9527', [
            'xxx' => 456,
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['3'], $vertexResult->getChildrenIds());
    }
}
