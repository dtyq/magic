<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Http;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use Hyperf\Codec\Json;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class HttpNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::Http, json_decode(<<<'JSON'
{
    "api": {
        "id": "component-6698da11b8ec6",
        "version": "1",
        "type": "api",
        "structure": {
            "method": "POST",
            "domain": "https://mock.apipark.cn/m1/2965792-0-default",
            "path": "/api/v1/app/{appId}/actions/{actionId}",
            "proxy": "",
            "auth": "",
            "uri": [
                {
                    "type": "input",
                    "value": "'/api/v1/app/'.",
                    "name": "/api/v1/app/",
                    "args": null
                },
                {
                    "type": "fields",
                    "value": "appId",
                    "name": "appId",
                    "args": null
                },
                {
                    "type": "input",
                    "value": ".'/actions/'.",
                    "name": "/actions/",
                    "args": null
                },
                {
                    "type": "fields",
                    "value": "actionId",
                    "name": "actionId",
                    "args": null
                }
            ],
            "url": "https://mock.apipark.cn/m1/2965792-0-default/api/v1/app/{appId}/actions/{actionId}",
            "request": {
                "params_path": {
                    "id": "component-111",
                    "type": "form",
                    "version": "1",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "desc",
                        "items": null,
                        "value": null,
                        "required": [
                            "appId",
                            "actionId"
                        ],
                        "properties": {
                            "appId": {
                                "type": "number",
                                "key": "appId",
                                "sort": 0,
                                "title": "应用id",
                                "description": "desc",
                                "items": null,
                                "properties": null,
                                "required": null,
                                "value": {
                                    "type": "const",
                                    "const_value": [
                                        {
                                            "type": "input",
                                            "value": "123",
                                            "name": "name",
                                            "args": null
                                        }
                                    ],
                                    "expression_value": null
                                }
                            },
                            "actionId": {
                                "type": "number",
                                "key": "actionId",
                                "sort": 1,
                                "title": "动作id",
                                "description": "desc",
                                "items": null,
                                "properties": null,
                                "required": null,
                                "value": {
                                    "type": "const",
                                    "const_value": [
                                        {
                                            "type": "input",
                                            "value": "456",
                                            "name": "name",
                                            "args": null
                                        }
                                    ],
                                    "expression_value": null
                                }
                            }
                        }
                    }
                },
                "params_query": {
                    "id": "component-111",
                    "type": "form",
                    "version": "1",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "desc",
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
                                "title": "名称",
                                "description": "desc",
                                "items": null,
                                "properties": null,
                                "required": null,
                                "value": {
                                    "type": "const",
                                    "const_value": [
                                        {
                                            "type": "input",
                                            "value": "哈哈哈",
                                            "name": "name",
                                            "args": null
                                        }
                                    ],
                                    "expression_value": null
                                }
                            }
                        }
                    }
                },
                "body_type": "json",
                "body": {
                    "id": "component-111",
                    "type": "form",
                    "version": "1",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "desc",
                        "items": null,
                        "value": null,
                        "required": [
                            "version"
                        ],
                        "properties": {
                            "version": {
                                "type": "number",
                                "key": "version",
                                "sort": 0,
                                "title": "版本",
                                "description": "desc",
                                "items": null,
                                "properties": null,
                                "required": null,
                                "value": {
                                    "type": "const",
                                    "const_value": [
                                        {
                                            "type": "input",
                                            "value": "1",
                                            "name": "name",
                                            "args": null
                                        }
                                    ],
                                    "expression_value": null
                                }
                            }
                        }
                    }
                },
                "headers": {
                    "id": "component-111",
                    "type": "form",
                    "version": "1",
                    "structure": {
                        "type": "object",
                        "key": "root",
                        "sort": 0,
                        "title": "root节点",
                        "description": "desc",
                        "items": null,
                        "value": null,
                        "required": [
                            "request-id"
                        ],
                        "properties": {
                            "request-id": {
                                "type": "string",
                                "key": "request-id",
                                "sort": 0,
                                "title": "请求id",
                                "description": "desc",
                                "items": null,
                                "properties": null,
                                "required": null,
                                "value": {
                                    "type": "expression",
                                    "const_value": null,
                                    "expression_value": [
                                        {
                                            "type": "methods",
                                            "value": "uniqid",
                                            "name": "uniqid",
                                            "args": null
                                        }
                                    ]
                                }
                            },
                            "apifoxToken": {
                                "type": "string",
                                "key": "apifoxToken",
                                "sort": 1,
                                "title": "apifoxToken",
                                "description": "desc",
                                "items": null,
                                "properties": null,
                                "required": null,
                                "value": {
                                    "type": "const",
                                    "const_value": [
                                        {
                                            "type": "input",
                                            "value": "xxxxx",
                                            "name": "name",
                                            "args": null
                                        }
                                    ],
                                    "expression_value": null
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
JSON, true));

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(Json::decode(
            <<<'JSON'
{
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "code"
        ],
        "properties": {
            "code": {
                "type": "integer",
                "key": "code",
                "sort": 0,
                "title": "code",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
}
JSON
        )));
        $node->setOutput($output);

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {
        //            $result = [
        //                'coe' => 1000,
        //            ];
        //            $vertexResult->setResult($result);
        //        });

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
