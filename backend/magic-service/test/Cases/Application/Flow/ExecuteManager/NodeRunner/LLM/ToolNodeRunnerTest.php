<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\LLM;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use Connector\Component\Structure\StructureType;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class ToolNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunByParameter()
    {
        $node = Node::generateTemplate(NodeType::Tool, [
            'tool_id' => 'MAGIC-FLOW-123456789abcde1-12345678',
            'mode' => 'parameter',
            'async' => false,
            'custom_system_input' => [
                'form' => ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-6734b427d0ddc",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "time"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "time": {
                "type": "string",
                "key": "time",
                "sort": 0,
                "title": "time",
                "description": "",
                "required": null,
                "value": {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "fields",
                            "value": "9527.time",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)),
            ],
        ]);
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-6734b427d0ddc",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "city_name"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "city_name": {
                "type": "string",
                "key": "city_name",
                "sort": 0,
                "title": "城市名称",
                "description": "",
                "required": null,
                "value": {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "fields",
                            "value": "9527.city_name",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
 {
    "id": "component-66a1f6bfe084f",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "foods"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "foods": {
                "type": "string",
                "key": "foods",
                "sort": 0,
                "title": "美食",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)));
        $node->setInput($input);
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'time' => 'time',
            'city_name' => 'xx',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunByLLM()
    {
        $node = Node::generateTemplate(NodeType::Tool, [
            'tool_id' => 'MAGIC-FLOW-123456789abcde1-12345678',
            'mode' => 'llm',
            'async' => false,
            'custom_system_input' => [
                'form' => ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-6734b427d0ddc",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "time"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "time": {
                "type": "string",
                "key": "time",
                "sort": 0,
                "title": "time",
                "description": "",
                "required": null,
                "value": {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "fields",
                            "value": "9527.time",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)),
            ],
            'user_prompt' => ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-66470a8b548c4",
    "version": "1",
    "type": "value",
    "structure": {
        "type": "expression",
        "const_value": null,
        "expression_value": [
            {
                "type": "fields",
                "value": "9527.input",
                "name": "",
                "args": null
            }
        ]
    }
}
JSON, true))->toArray(),
            'model' => 'gpt-4o-global',
        ]);
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-6734b427d0ddc",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "city_name"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "city_name": {
                "type": "string",
                "key": "city_name",
                "sort": 0,
                "title": "城市名称",
                "description": "",
                "required": null,
                "value": {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "fields",
                            "value": "9527.city_name",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
 {
    "id": "component-66a1f6bfe084f",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "foods"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "foods": {
                "type": "string",
                "key": "foods",
                "sort": 0,
                "title": "美食",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON, true)));
        $node->setInput($input);
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'time' => 'time',
            'input' => '我明天想去东莞玩耍',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testFileList()
    {
        $node = Node::generateTemplate(NodeType::Tool, [
            'tool_id' => 'file_box_file_list',
            'mode' => 'parameter',
            'async' => false,
            'custom_system_input' => [
                'form' => ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
                "id": "component-674c4f70bc3a8",
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
                    "encryption": false,
                    "encryption_value": null,
                    "items": null,
                    "properties": {}
                }
            }
JSON, true)),
            ],
        ]);
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
            "id": "component-674ec25670b45",
            "version": "1",
            "type": "form",
            "structure": {
                "type": "object",
                "key": "root",
                "sort": 0,
                "title": "root节点",
                "description": "",
                "required": [],
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": {
                    "limit": {
                        "type": "number",
                        "key": "limit",
                        "sort": 0,
                        "title": "查询数量",
                        "description": "查询数量 默认 10",
                        "required": null,
                        "value": {
                            "type": "const",
                            "const_value": [
                                {
                                    "type": "fields",
                                    "value": "9527.limit",
                                    "name": "",
                                    "args": null
                                }
                            ],
                            "expression_value": null
                        },
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "sort": {
                        "type": "string",
                        "key": "sort",
                        "sort": 1,
                        "title": "排序",
                        "description": "排序规则。asc 升序;desc 降序。默认 desc",
                        "required": null,
                        "value": {
                            "type": "const",
                            "const_value": [
                                {
                                    "type": "fields",
                                    "value": "9527.sort",
                                    "name": "",
                                    "args": null
                                }
                            ],
                            "expression_value": null
                        },
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "start_time": {
                        "type": "string",
                        "key": "start_time",
                        "sort": 2,
                        "title": "开始时间",
                        "description": "时间范围搜索的开始时间。格式示例：Y-m-d H:i:s",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "end_time": {
                        "type": "string",
                        "key": "end_time",
                        "sort": 3,
                        "title": "结束时间",
                        "description": "时间范围搜索的结束时间。格式示例：Y-m-d H:i:s",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    }
                }
            }
        }
JSON, true)));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
            "id": "component-674ec25670b5a",
            "version": "1",
            "type": "form",
            "structure": {
                "type": "object",
                "key": "root",
                "sort": 0,
                "title": "root节点",
                "description": "",
                "required": [],
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": {
                    "files": {
                        "type": "array",
                        "key": "files",
                        "sort": 0,
                        "title": "文件列表",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": {
                            "type": "object",
                            "key": "files",
                            "sort": 0,
                            "title": "文件",
                            "description": "",
                            "required": [
                                "file_name",
                                "file_url"
                            ],
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": {
                                "file_name": {
                                    "type": "string",
                                    "key": "file_name",
                                    "sort": 0,
                                    "title": "文件名称",
                                    "description": "",
                                    "required": null,
                                    "value": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "items": null,
                                    "properties": null
                                },
                                "file_url": {
                                    "type": "string",
                                    "key": "file_url",
                                    "sort": 1,
                                    "title": "文件地址",
                                    "description": "",
                                    "required": null,
                                    "value": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "items": null,
                                    "properties": null
                                },
                                "file_ext": {
                                    "type": "string",
                                    "key": "file_ext",
                                    "sort": 2,
                                    "title": "文件后缀",
                                    "description": "",
                                    "required": null,
                                    "value": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "items": null,
                                    "properties": null
                                },
                                "file_size": {
                                    "type": "number",
                                    "key": "file_size",
                                    "sort": 3,
                                    "title": "文件大小",
                                    "description": "",
                                    "required": null,
                                    "value": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "items": null,
                                    "properties": null
                                }
                            }
                        },
                        "properties": null
                    }
                }
            }
        }
JSON, true)));
        $node->setInput($input);
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData(triggerType: TriggerType::ChatMessage, executionType: ExecutionType::IMChat);
        $executionData->setOriginConversationId('123456789012345678');
        $executionData->setTopicId('123456789012345679');
        $executionData->saveNodeContext('9527', [
            'limit' => 20,
            'sort' => 'asc',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunLLMUserSearch()
    {
        $node = Node::generateTemplate(NodeType::Tool, json_decode(
            <<<'JSON'
{
    "tool_id": "atomic_node_user_search",
    "mode": "llm",
    "custom_system_input": {
        "widget": null,
        "form": {
            "id": "component-677e4fbdc717b",
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
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            }
        }
    },
    "async": false,
    "model": "gpt-4o-global",
    "model_config": {
        "auto_memory": false,
        "max_record": 50,
        "temperature": 0.5
    },
    "user_prompt": {
        "id": "component-674c4f70bc485",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "我想找一下小明",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON,
            true
        ));
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $node->setInput($input);
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
