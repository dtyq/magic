<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Chat\V0;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class CreateGroupNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::CreateGroup, json_decode(
            <<<'JSON'
{
    "group_name": {
        "id": "component-675a8f8f40326",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.group_name",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "group_owner": {
        "id": "component-675a8f8f40367",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "const",
            "const_value": [
                {
                    "type": "member",
                    "value": "message",
                    "name": "message",
                    "args": null,
                    "member_value": [
                        {
                            "id": "usi_123456789abcdef123456789abcdef12",
                            "name": "小刚"
                        }
                    ]
                }
            ],
            "expression_value": null
        }
    },
    "group_members": {
        "id": "component-675a8f8f4036d",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "const",
            "const_value": [
                {
                    "type": "member",
                    "value": "message",
                    "name": "message",
                    "args": null,
                    "member_value": [
                        {
                            "id": "usi_123456789abcdef123456789abcdef13",
                            "name": "小红"
                        },
                        {
                            "id": "usi_123456789abcdef123456789abcdef14",
                            "name": "小明"
                        },
                        {
                            "id": "usi_123456789abcdef123456789abcdef12",
                            "name": "小刚"
                        }
                    ]
                }
            ],
            "expression_value": null
        }
    },
    "group_type": 5,
    "include_current_user": true,
    "include_current_assistant": true
}
JSON,
            true
        ));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'group_name' => '单测创建的测试群聊',
        ]);
        $executionData->getTriggerData()->setAgentKey('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
