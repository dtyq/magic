<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Start;

use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Chat\DTO\Message\ChatMessage\FilesMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\RoutineConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\StartNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use DateTime;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class StartNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testChatMessage()
    {
        $node = Node::generateTemplate(NodeType::Start, [
            'branches' => [
                [
                    'trigger_type' => 1,
                    'next_nodes' => ['node_1'],
                    'config' => null,
                    'input' => null,
                ],
            ],
        ]);
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();

        $content = 'hello world';
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: [
                'user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname()),
            ],
            messageInfo: [
                'message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => $content])),
            ],
            params: [],
        );
        $executionData = $this->createExecutionData(TriggerType::ChatMessage, $triggerData);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals(['node_1'], $vertexResult->getChildrenIds());
        $this->assertEquals($content, $executionData->getNodeContext($node->getNodeId())['content']);
    }

    public function testChatMessageOnlyFile()
    {
        $node = Node::generateTemplate(NodeType::Start, [
            'branches' => [
                [
                    'trigger_type' => 1,
                    'next_nodes' => ['node_1'],
                    'config' => null,
                    'input' => null,
                ],
            ],
        ]);
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();

        $message = new FilesMessage(json_decode(<<<'JSON'
{
    "attachments": [
        {
            "file_id": "719913005834338305",
            "file_type": 4,
            "file_extension": "xlsx",
            "file_size": 9180,
            "file_name": "你好.xlsx"
        }
    ]
}
JSON, true));
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: [
                'user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname()),
            ],
            messageInfo: [
                'message_entity' => TriggerData::createMessageEntity($message),
            ],
            params: [],
        );
        $executionData = $this->createExecutionData(TriggerType::ChatMessage, $triggerData);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals(['node_1'], $vertexResult->getChildrenIds());
        $this->assertIsArray($executionData->getNodeContext($node->getNodeId())['files']);
    }

    public function testOpenChatWindow()
    {
        $node = Node::generateTemplate(NodeType::Start, [
            'branches' => [
                [
                    'trigger_type' => 2,
                    'next_nodes' => ['node_2'],
                    'config' => [
                        'interval' => 10,
                        'unit' => 'second',
                    ],
                    'input' => null,
                ],
            ],
        ]);
        $runner = NodeRunnerFactory::make($node);

        $content = 'hello world';
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => $content]))],
            params: [],
        );

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData(TriggerType::OpenChatWindow, $triggerData);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals(['node_2'], $vertexResult->getChildrenIds());

        // 10s内，所以不会执行
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEmpty($vertexResult->getChildrenIds());
    }

    public function testAddFriend()
    {
        $node = Node::generateTemplate(NodeType::Start, [
            'branches' => [
                [
                    'trigger_type' => 7,
                    'next_nodes' => ['node_1'],
                    'config' => null,
                    'input' => null,
                ],
            ],
        ]);
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();

        $content = '';
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: [
                'user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname()),
            ],
            messageInfo: [
                'message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => $content])),
            ],
            params: [],
        );
        $executionData = $this->createExecutionData(TriggerType::AddFriend, $triggerData);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals(['node_1'], $vertexResult->getChildrenIds());
    }

    public function testParamCall()
    {
        $node = Node::generateTemplate(NodeType::Start, json_decode(
            <<<'JSON'
{
    "branches": [
        {
            "trigger_type": 4,
            "next_nodes": [
                "node_4"
            ],
            "config": null,
            "output": {
                "form": {
                    "type": "form",
                    "version": "1",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "root节点",
                        "items": null,
                        "value": null,
                        "required": [
                            "name"
                        ],
                        "properties": {
                            "name": {
                                "type": "string",
                                "key": "name",
                                "sort": 0,
                                "title": "name",
                                "description": "name",
                                "items": null,
                                "value": null,
                                "required": null,
                                "properties": null
                            }
                        }
                    }
                }
            },
            "custom_system_output": {
                "form": {
                    "type": "form",
                    "version": "1",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "root节点",
                        "items": null,
                        "value": null,
                        "required": [
                            "system"
                        ],
                        "properties": {
                            "system": {
                                "type": "string",
                                "key": "system",
                                "sort": 0,
                                "title": "system",
                                "description": "system",
                                "items": null,
                                "value": null,
                                "required": null,
                                "properties": null
                            }
                        }
                    }
                }
            }
        }
    ]
}
JSON,
            true
        ));
        $runner = NodeRunnerFactory::make($node);
        $operator = $this->getOperator();
        $vertexResult = new VertexResult();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [
                'name' => 'l',
            ],
            systemParams: [
                'system' => 'system112',
            ],
        );
        $executionData = $this->createExecutionData(TriggerType::ParamCall, $triggerData);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertEquals(['node_4'], $vertexResult->getChildrenIds());
        $this->assertEquals($triggerData->getParams(), $executionData->getNodeContext($node->getNodeId()));
        $this->assertNotEmpty($executionData->getNodeContext($node->getSystemNodeId()));
        $this->assertArrayHasKey('system', $executionData->getNodeContext($node->getCustomSystemNodeId()));
    }

    public function testRunRoutine()
    {
        $node = Node::generateTemplate(NodeType::Start, json_decode(<<<'JSON'
{
    "branches": [
        {
            "branch_id": "branch_66d99f7eabfab",
            "trigger_type": 3,
            "next_nodes": ["123"],
            "config": {
                "type": "weekday_repeat",
                "day": null,
                "time": "00:00",
                "value": {
                    "interval": null,
                    "unit": null,
                    "values": [],
                    "deadline": null
                }
            },
            "input": {
                "widget": {
                    "id": "component-66d99f7eabfbc",
                    "version": "1",
                    "type": "widget",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "",
                        "description": "",
                        "initial_value": null,
                        "value": null,
                        "display_config": null,
                        "items": null,
                        "properties": null
                    }
                },
                "form": {
                    "id": "component-66d99f7eabfb2",
                    "version": "1",
                    "type": "form",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "",
                        "required": [
                            "trigger_time",
                            "trigger_timestamp"
                        ],
                        "value": null,
                        "items": null,
                        "properties": {
                            "trigger_time": {
                                "type": "string",
                                "key": "trigger_time",
                                "sort": 0,
                                "title": "触发时间",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            },
                            "trigger_timestamp": {
                                "type": "number",
                                "key": "trigger_timestamp",
                                "sort": 1,
                                "title": "触发时间戳",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            }
                        }
                    }
                }
            },
            "output": {
                "widget": {
                    "id": "component-66d99f7eabfbc",
                    "version": "1",
                    "type": "widget",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "",
                        "description": "",
                        "initial_value": null,
                        "value": null,
                        "display_config": null,
                        "items": null,
                        "properties": null
                    }
                },
                "form": {
                    "id": "component-66d99f7eabfb2",
                    "version": "1",
                    "type": "form",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "",
                        "required": [
                            "trigger_time",
                            "trigger_timestamp"
                        ],
                        "value": null,
                        "items": null,
                        "properties": {
                            "trigger_time": {
                                "type": "string",
                                "key": "trigger_time",
                                "sort": 0,
                                "title": "触发时间",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            },
                            "trigger_timestamp": {
                                "type": "number",
                                "key": "trigger_timestamp",
                                "sort": 1,
                                "title": "触发时间戳",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            }
                        }
                    }
                }
            }
        },
        {
            "branch_id": "branch_66d99f7eabfa1",
            "trigger_type": 3,
            "next_nodes": ["456"],
            "config": {
                "type": "weekday_repeat",
                "day": null,
                "time": "00:01",
                "value": {
                    "interval": null,
                    "unit": null,
                    "values": [],
                    "deadline": null
                }
            },
            "input": {
                "widget": {
                    "id": "component-66d99f7eabfbc",
                    "version": "1",
                    "type": "widget",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "",
                        "description": "",
                        "initial_value": null,
                        "value": null,
                        "display_config": null,
                        "items": null,
                        "properties": null
                    }
                },
                "form": {
                    "id": "component-66d99f7eabfb2",
                    "version": "1",
                    "type": "form",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "",
                        "required": [
                            "trigger_time",
                            "trigger_timestamp"
                        ],
                        "value": null,
                        "items": null,
                        "properties": {
                            "trigger_time": {
                                "type": "string",
                                "key": "trigger_time",
                                "sort": 0,
                                "title": "触发时间",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            },
                            "trigger_timestamp": {
                                "type": "number",
                                "key": "trigger_timestamp",
                                "sort": 1,
                                "title": "触发时间戳",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            }
                        }
                    }
                }
            },
            "output": {
                "widget": {
                    "id": "component-66d99f7eabfbc",
                    "version": "1",
                    "type": "widget",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "",
                        "description": "",
                        "initial_value": null,
                        "value": null,
                        "display_config": null,
                        "items": null,
                        "properties": null
                    }
                },
                "form": {
                    "id": "component-66d99f7eabfb2",
                    "version": "1",
                    "type": "form",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "",
                        "required": [
                            "trigger_time",
                            "trigger_timestamp"
                        ],
                        "value": null,
                        "items": null,
                        "properties": {
                            "trigger_time": {
                                "type": "string",
                                "key": "trigger_time",
                                "sort": 0,
                                "title": "触发时间",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            },
                            "trigger_timestamp": {
                                "type": "number",
                                "key": "trigger_timestamp",
                                "sort": 1,
                                "title": "触发时间戳",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": null
                            }
                        }
                    }
                }
            }
        }
    ]
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $datetime = new DateTime();
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [
                'trigger_time' => $datetime->format('Y-m-d H:i:s'),
                'trigger_timestamp' => $datetime->getTimestamp(),
                'branch_id' => 'branch_66d99f7eabfa1',
            ],
        );
        $executionData = $this->createExecutionData(TriggerType::Routine, $triggerData);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());

        /** @var StartNodeParamsConfig $nodeParamsConfig */
        $nodeParamsConfig = $node->getNodeParamsConfig();
        /** @var null|RoutineConfig $routineConfig */
        $routineConfig = $nodeParamsConfig->getRoutineConfigs()['branch_66d99f7eabfab'] ?? null;
        $this->assertInstanceOf(RoutineConfig::class, $routineConfig);
        $this->assertEquals('00 00 * * 1-5', $routineConfig->getCrontabRule());
        $this->assertEquals([
            'trigger_time' => $datetime->format('Y-m-d H:i:s'),
            'trigger_timestamp' => $datetime->getTimestamp(),
            'branch_id' => 'branch_66d99f7eabfa1',
        ], $executionData->getNodeContext($node->getNodeId()));
        $this->assertEquals(['456'], $vertexResult->getChildrenIds());

        $vertexResult = new VertexResult();
        $datetime = new DateTime();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [
                'trigger_time' => $datetime->format('Y-m-d H:i:s'),
                'trigger_timestamp' => $datetime->getTimestamp(),
                'branch_id' => 'branch_66d99f7eabfab',
            ],
        );
        $executionData = $this->createExecutionData(TriggerType::Routine, $triggerData);
        $runner->execute($vertexResult, $executionData, []);

        /** @var StartNodeParamsConfig $nodeParamsConfig */
        $nodeParamsConfig = $node->getNodeParamsConfig();
        /** @var null|RoutineConfig $routineConfig */
        $routineConfig = $nodeParamsConfig->getRoutineConfigs()['branch_66d99f7eabfab'] ?? null;
        $this->assertInstanceOf(RoutineConfig::class, $routineConfig);
        $this->assertEquals('00 00 * * 1-5', $routineConfig->getCrontabRule());
        $this->assertEquals([
            'trigger_time' => $datetime->format('Y-m-d H:i:s'),
            'trigger_timestamp' => $datetime->getTimestamp(),
            'branch_id' => 'branch_66d99f7eabfab',
        ], $executionData->getNodeContext($node->getNodeId()));
        $this->assertEquals(['123'], $vertexResult->getChildrenIds());
    }

    public function testAppointTriggerType()
    {
        $node = Node::generateTemplate(NodeType::Start, [
            'branches' => [
                [
                    'trigger_type' => 1,
                    'next_nodes' => ['node_1'],
                    'config' => null,
                    'input' => null,
                ],
                [
                    'trigger_type' => 2,
                    'next_nodes' => ['node_2'],
                    'config' => [
                        'interval' => 10,
                        'unit' => 'minute',
                    ],
                    'input' => null,
                ],
                [
                    'trigger_type' => 4,
                    'next_nodes' => ['node_4'],
                    'config' => null,
                    'output' => [
                        'form' => [
                            'type' => 'form',
                            'version' => '1',
                            'structure' => [
                                'type' => 'object',
                                'key' => 'root',
                                'sort' => 0,
                                'title' => 'root节点',
                                'description' => 'root节点',
                                'items' => null,
                                'value' => null,
                                'required' => [
                                    'name',
                                ],
                                'properties' => [
                                    'name' => [
                                        'type' => 'string',
                                        'key' => 'name',
                                        'sort' => 0,
                                        'title' => 'name',
                                        'description' => 'name',
                                        'items' => null,
                                        'value' => null,
                                        'required' => null,
                                        'properties' => null,
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ]);
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();

        $content = 'hello world';
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => $content]))],
            params: [
                'name' => 'l',
            ],
        );
        $executionData = $this->createExecutionData(TriggerType::ChatMessage, $triggerData);
        $runner->execute($vertexResult, $executionData, ['appoint_trigger_type' => TriggerType::ParamCall]);
        $this->assertEquals([
            'name' => 'l',
        ], $executionData->getNodeContext($node->getNodeId()));
    }
}
