<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class KnowledgeSimilarityNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunAny()
    {
        $node = Node::generateTemplate(NodeType::KnowledgeSimilarity, json_decode(
            <<<'JSON'
{
    "knowledge_codes": ["KNOWLEDGE-6747dd15168cd4-50195575"],
    "query": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "币种",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "metadata_filter": {
        "id": "component-66a0a6c5b190f",
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
                "dataset_id": {
                    "type": "array",
                    "title": "",
                    "description": "",
                    "value": {
                      "type": "expression",
                      "const_value": null,
                      "expression_value": [
                        {
                          "type": "fields",
                          "uniqueId": "9527.dataset_id",
                          "value": "9527.dataset_id"
                        }
                      ]
                    }
                  }
            }
        }
    },
    "limit": 5,
    "score": 0.4
}
JSON,
            true
        ));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-669792b0e9469",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "similarity_contents",
            "similarity_content"
        ],
        "value": null,
        "items": null,
        "properties": {
            "similarity_contents": {
                "type": "array",
                "key": "similarity_contents",
                "sort": 0,
                "title": "召回结果集",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "结果",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            },
            "similarity_content": {
                "type": "string",
                "key": "similarity_content",
                "sort": 1,
                "title": "召回结果",
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

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'dataset_id' => ['606082127620485121'],
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunValue()
    {
        $node = Node::generateTemplate(NodeType::KnowledgeSimilarity, json_decode(
            <<<'JSON'
{
    "knowledge_codes": ["KNOWLEDGE-6747dd15168cd4-50195575"],
    "query": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "币种",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "metadata_filter": {
        "id": "component-66a0a6c5b190f",
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
                "dataset_id": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": {
                      "type": "expression",
                      "const_value": null,
                      "expression_value": [
                        {
                          "type": "fields",
                          "uniqueId": "9527.dataset_id",
                          "value": "9527.dataset_id"
                        }
                      ]
                    }
                  }
            }
        }
    },
    "limit": 5,
    "score": 0.4
}
JSON,
            true
        ));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-669792b0e9469",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "similarity_contents",
            "similarity_content"
        ],
        "value": null,
        "items": null,
        "properties": {
            "similarity_contents": {
                "type": "array",
                "key": "similarity_contents",
                "sort": 0,
                "title": "召回结果集",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "结果",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            },
            "similarity_content": {
                "type": "string",
                "key": "similarity_content",
                "sort": 1,
                "title": "召回结果",
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

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'dataset_id' => '606082127620485121',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunVectorDatabaseIds()
    {
        $node = Node::generateTemplate(NodeType::KnowledgeSimilarity, json_decode(
            <<<'JSON'
{
    "vector_database_ids": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.vector_database_ids",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "query": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "币种",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "metadata_filter": {
        "id": "component-66a0a6c5b190f",
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
                "dataset_id": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": {
                      "type": "expression",
                      "const_value": null,
                      "expression_value": [
                        {
                          "type": "fields",
                          "uniqueId": "9527.dataset_id",
                          "value": "9527.dataset_id"
                        }
                      ]
                    }
                  }
            }
        }
    },
    "limit": 5,
    "score": 0.5
}
JSON,
            true
        ));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-669792b0e9469",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "similarity_contents",
            "similarity_content"
        ],
        "value": null,
        "items": null,
        "properties": {
            "similarity_contents": {
                "type": "array",
                "key": "similarity_contents",
                "sort": 0,
                "title": "召回结果集",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "结果",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            },
            "similarity_content": {
                "type": "string",
                "key": "similarity_content",
                "sort": 1,
                "title": "召回结果",
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

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'vector_database_ids' => ['KNOWLEDGE-6747dd15168cd4-50195575'],
            'dataset_id' => '606082127620485121',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunVectorDatabaseIds1()
    {
        $node = Node::generateTemplate(NodeType::KnowledgeSimilarity, json_decode(
            <<<'JSON'
{
    "knowledge_codes": [
      "KNOWLEDGE-6747dd15168cd4-50195575"
    ],
    "vector_database_ids": {
        "id": "524838571983126529",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "const",
            "const_value": [
                {
                    "type": "names",
                    "value": "",
                    "name": "",
                    "args": null,
                    "names_value": [
                        {
                            "id": "KNOWLEDGE-6747dd15168cd4-50195575",
                            "name": "无权限数据库"
                        }
                    ]
                }
            ],
            "expression_value": null
        }
    },
    "query": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "币种",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "metadata_filter": {
        "id": "component-66a0a6c5b190f",
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
                "dataset_id": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": {
                      "type": "expression",
                      "const_value": null,
                      "expression_value": [
                        {
                          "type": "fields",
                          "uniqueId": "9527.dataset_id",
                          "value": "9527.dataset_id"
                        }
                      ]
                    }
                  }
            }
        }
    },
    "limit": 5,
    "score": 0.5
}
JSON,
            true
        ));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-669792b0e9469",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "similarity_contents",
            "similarity_content"
        ],
        "value": null,
        "items": null,
        "properties": {
            "similarity_contents": {
                "type": "array",
                "key": "similarity_contents",
                "sort": 0,
                "title": "召回结果集",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "结果",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            },
            "similarity_content": {
                "type": "string",
                "key": "similarity_content",
                "sort": 1,
                "title": "召回结果",
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

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'vector_database_ids' => ['KNOWLEDGE-6747dd15168cd4-50195575'],
            'dataset_id' => '606082127620485121',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunUserTopic()
    {
        $node = Node::generateTemplate(NodeType::KnowledgeSimilarity, json_decode(
            <<<'JSON'
{
    "vector_database_ids": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.vector_database_ids",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "query": {
        "id": "component-669792b0e8864",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "币种",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "metadata_filter": {
        "id": "component-66a0a6c5b190f",
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
                "dataset_id": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": {
                      "type": "expression",
                      "const_value": null,
                      "expression_value": [
                        {
                          "type": "fields",
                          "uniqueId": "9527.dataset_id",
                          "value": "9527.dataset_id"
                        }
                      ]
                    }
                  }
            }
        }
    },
    "limit": 5,
    "score": 0.5
}
JSON,
            true
        ));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-669792b0e9469",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "similarity_contents",
            "similarity_content"
        ],
        "value": null,
        "items": null,
        "properties": {
            "similarity_contents": {
                "type": "array",
                "key": "similarity_contents",
                "sort": 0,
                "title": "召回结果集",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "结果",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            },
            "similarity_content": {
                "type": "string",
                "key": "similarity_content",
                "sort": 1,
                "title": "召回结果",
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

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'vector_database_ids' => [ConstValue::KNOWLEDGE_USER_CURRENT_TOPIC],
            'dataset_id' => '606082127620485121',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
