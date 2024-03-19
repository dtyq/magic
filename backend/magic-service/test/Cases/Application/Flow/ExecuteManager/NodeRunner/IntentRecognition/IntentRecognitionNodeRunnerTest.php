<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\IntentRecognition;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class IntentRecognitionNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::IntentRecognition, json_decode(
            <<<'JSON'
 {
    "model": {
        "id": "component-66dac0afc2765",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "gpt-4o-global",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "branches": [
        {
            "branch_id": "branch_66dac0afc2afc",
            "branch_type": "if",
            "title": {
                "id": "component-66dac0afc2afe",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "吃饭",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            },
            "desc": {
                "id": "component-66dac0afc2b0f",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "品尝了美食，喝了饮料，喝水不算",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            },
            "next_nodes": ["123"],
            "parameters": null
        },
        {
            "branch_id": "branch_66dac0afc2b19",
            "branch_type": "else",
            "title": "",
            "desc": "",
            "next_nodes": ["456"],
            "parameters": null
        }
    ]
}
JSON,
            true
        ));
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(json_decode(
            <<<'JSON'
{
                "id": "component-66dac0afc2e08",
                "version": "1",
                "type": "form",
                "structure": {
                    "type": "object",
                    "key": "root",
                    "sort": 0,
                    "title": "root节点",
                    "description": "",
                    "required": [
                        "intent"
                    ],
                    "value": null,
                    "items": null,
                    "properties": {
                        "intent": {
                            "type": "string",
                            "key": "intent",
                            "sort": 0,
                            "title": "意图",
                            "description": "",
                            "required": null,
                            "value": {
                                "type": "expression",
                                "expression_value": [
                                    {
                                        "type": "fields",
                                        "value": "9527.intent",
                                        "name": "intent",
                                        "args": null
                                    }
                                ],
                                "const_value": null
                            },
                            "items": null,
                            "properties": null
                        }
                    }
                }
            }
JSON,
            true
        )));
        $node->setInput($input);
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'intent' => '我今天去了广州看了小蛮腰，下次想带我朋友一起去',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['456'], $vertexResult->getChildrenIds());

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'intent' => '我今天吃了糖醋排骨',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['123'], $vertexResult->getChildrenIds());
    }

    public function testRun1()
    {
        $node = Node::generateTemplate(NodeType::IntentRecognition, json_decode(
            <<<'JSON'
 {
    "model": {
        "id": "component-66dac0afc2765",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "gpt-4o-global",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "branches": [
        {
            "branch_id": "branch_66dac0afc2afc",
            "branch_type": "if",
            "title": {
                "id": "component-66dac0afc2afe",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "吃饭",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            },
            "desc": {
                "id": "component-66dac0afc2b0f",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "品尝了美食\n喝了饮料\n喝水不算",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            },
            "next_nodes": ["123"],
            "parameters": null
        },
        {
            "branch_id": "branch_66dac0afc2b19",
            "branch_type": "else",
            "title": "",
            "desc": "",
            "next_nodes": ["456"],
            "parameters": null
        }
    ]
}
JSON,
            true
        ));
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(json_decode(
            <<<'JSON'
{
                "id": "component-66dac0afc2e08",
                "version": "1",
                "type": "form",
                "structure": {
                    "type": "object",
                    "key": "root",
                    "sort": 0,
                    "title": "root节点",
                    "description": "",
                    "required": [
                        "intent"
                    ],
                    "value": null,
                    "items": null,
                    "properties": {
                        "intent": {
                            "type": "string",
                            "key": "intent",
                            "sort": 0,
                            "title": "意图",
                            "description": "",
                            "required": null,
                            "value": {
                                "type": "expression",
                                "expression_value": [
                                    {
                                        "type": "fields",
                                        "value": "9527.intent",
                                        "name": "intent",
                                        "args": null
                                    }
                                ],
                                "const_value": null
                            },
                            "items": null,
                            "properties": null
                        }
                    }
                }
            }
JSON,
            true
        )));
        $node->setInput($input);
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'intent' => '我今天去了广州吃了莞城大包，下次想带我朋友一起去',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['123'], $vertexResult->getChildrenIds());
    }
}
