<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Loop;

use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Factory\MagicFlowFactory;
use DateTime;
use Hyperf\Codec\Json;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class LoopMainNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunCount()
    {
        $magicFlow = $this->createMagicFlowCount();
        $operator = $this->getOperator();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [
                'var1' => '111',
            ],
        );
        $executionData = $this->createExecutionData(TriggerType::ParamCall, $triggerData);
        $executor = new MagicFlowExecutor($magicFlow, $executionData);
        $executor->execute();

        foreach ($magicFlow->getNodes() as $node) {
            if ($node->getNodeDebugResult()) {
                $this->assertTrue($node->getNodeDebugResult()->isSuccess());
            }
        }
    }

    private function createMagicFlowCount(): MagicFlowEntity
    {
        $array = Json::decode(
            <<<'JSON'
{
    "id": 1,
    "code": "MAGIC-FLOW-66ab6425d066a7-xxx",
    "name": "测试循环节点",
    "description": "",
    "icon": "",
    "type": 1,
    "edges": [
    ],
    "nodes": [
        {
            "node_id": "MAGIC-FLOW-NODE-66dfe2b8223d85-83130117",
            "name": "开始节点",
            "description": "",
            "node_type": 1,
            "meta": {},
            "params": {
                "branches": [
                    {
                        "input": {
                            "form": {
                                "id": "component-66a1bd9ea09e0",
                                "type": "form",
                                "version": "1",
                                "structure": {
                                    "key": "root",
                                    "sort": 0,
                                    "type": "object",
                                    "items": null,
                                    "title": null,
                                    "value": null,
                                    "required": [],
                                    "properties": {
                                        "var1" : {
                                            "type": "string",
                                            "key": "var1",
                                            "sort": 0,
                                            "title": null,
                                            "description": null,
                                            "required": [],
                                            "value": null,
                                            "items": null,
                                            "properties": null
                                        }
                                    },
                                    "description": null
                                }
                            },
                            "widget": null
                        },
                        "config": null,
                        "output": null,
                        "branch_id": "branch_66a1bd9ea09de",
                        "next_nodes": [
                            "MAGIC-FLOW-NODE-66dfc283ad6ba2-06103935"
                        ],
                        "trigger_type": 4
                    }
                ]
            },
            "next_nodes": [
                "MAGIC-FLOW-NODE-66dfc283ad6ba2-06103935"
            ],
            "input": {
                "widget": null,
                "form": null
            },
            "output": {
                "widget": null,
                "form": null
            }
        },
        {
            "node_id": "MAGIC-FLOW-NODE-66dfc283ad6ba2-06103935",
            "name": "循环",
            "description": "",
            "node_type": 30,
            "meta": {
                "relation_id": "MAGIC-FLOW-NODE-66dfc3d81b31b1-78900688"
            },
            "params": {
                "type": "count",
                "condition": {
                    "id": "component-66dfc283adb7a",
                    "version": "1",
                    "type": "condition",
                    "structure": null
                },
                "count": {
                    "id": "component-66dfc283adcdf",
                    "version": "1",
                    "type": "value",
                    "structure": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "input",
                                "value": "3",
                                "name": "",
                                "args": null
                            }
                        ]
                    }
                },
                "array": {
                    "id": "component-66dfc283adf21",
                    "version": "1",
                    "type": "value",
                    "structure": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "input",
                                "value": "",
                                "name": "",
                                "args": null
                            }
                        ]
                    }
                },
                "max_loop_count": {
                    "id": "component-66dfc283adf2e",
                    "version": "1",
                    "type": "value",
                    "structure": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "input",
                                "value": "",
                                "name": "",
                                "args": null
                            }
                        ]
                    }
                }
            },
            "next_nodes": [],
            "input": null,
            "output": null
        },
        {
            "node_id": "MAGIC-FLOW-NODE-66dfc3d81b31b1-78900688",
            "name": "循环体",
            "description": "",
            "node_type": 31,
            "meta": {
                "parent_id": "MAGIC-FLOW-NODE-66dfc283ad6ba2-06103935"
            },
            "params": [],
            "next_nodes": [],
            "input": null,
            "output": null
        },
        {
            "node_id": "MAGIC-FLOW-NODE-66dfc32637e0b5-42629375",
            "name": "循环开始节点",
            "description": "",
            "node_type": 1,
            "meta": {
                "parent_id": "MAGIC-FLOW-NODE-66dfc3d81b31b1-78900688"
            },
            "params": {
                "branches": [
                    {
                        "input": {
                            "form": {
                                "id": "component-66dfc326391ff",
                                "type": "form",
                                "version": "1",
                                "structure": {
                                    "key": "root",
                                    "sort": 0,
                                    "type": "object",
                                    "items": null,
                                    "title": null,
                                    "value": null,
                                    "required": [],
                                    "properties": null,
                                    "description": null
                                }
                            },
                            "widget": null
                        },
                        "config": null,
                        "output": null,
                        "branch_id": "branch_66dfc32638192",
                        "next_nodes": [
                            "MAGIC-FLOW-NODE-66dfddf5198532-03952904"
                        ],
                        "trigger_type": 5
                    }
                ]
            },
            "next_nodes": [
                "MAGIC-FLOW-NODE-66dfddf5198532-03952904"
            ],
            "input": {
                "widget": null,
                "form": null
            },
            "output": {
                "widget": null,
                "form": null
            }
        },
        {
            "node_id": "MAGIC-FLOW-NODE-66dfddf5198532-03952904",
            "name": "变量设置",
            "description": "",
            "node_type": 21,
            "meta": {
                "parent_id": "MAGIC-FLOW-NODE-66dfc3d81b31b1-78900688"
            },
            "params": {
                "variables": {
                    "form": {
                        "id": "component-66dfddf51af18",
                        "version": "1",
                        "type": "form",
                        "structure": {
                            "type": "object",
                            "key": "root",
                            "sort": 0,
                            "title": null,
                            "description": null,
                            "required": [],
                            "value": null,
                            "items": null,
                            "properties": {
                                "var1" : {
                                    "type": "string",
                                    "key": "var1",
                                    "sort": 0,
                                    "title": null,
                                    "description": null,
                                    "required": [],
                                    "value": {
                                        "type": "expression",
                                        "const_value": null,
                                        "expression_value": [
                                            {
                                                "type": "input",
                                                "value": "3",
                                                "name": "478873452756606976.var1",
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
            },
            "next_nodes": [],
            "input": null,
            "output": null
        }
    ],
    "enabled": true,
    "version_code": "",
    "organization_code": "DT001",
    "creator": "606446434040061952",
    "created_at": "2024-08-01 18:32:05",
    "modifier": "606488063299981312",
    "updated_at": "2024-09-03 11:34:56"
}
JSON
        );

        return MagicFlowFactory::arrayToEntity($array);
    }
}
