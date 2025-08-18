<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage;

use App\Application\Flow\ExecuteManager\Attachment\Attachment;
use App\Application\Flow\ExecuteManager\Attachment\ExternalAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use DateTime;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class ReplyMessageNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunText()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "text",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": null,
    "link_desc": null
}
JSON, true));
        $node->setDebug(true);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'content' => '你好，你是谁',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunTextForChat()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "text",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": null,
    "link_desc": null
}
JSON, true));
        $node->setDebug(true);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData(executionType: ExecutionType::IMChat);
        $executionData->setFlowCode('MAGIC-FLOW-678ded052eaee2-19893262', '', '');
        $executionData->saveNodeContext('9527', [
            'content' => '你好，你是谁' . time(),
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunTextForRoutine()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "text",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": null,
    "link_desc": null,
    "recipients": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "const",
            "const_value": [
                {
                    "type": "member",
                    "value": "",
                    "name": "message",
                    "args": null,
                    "member_value": [
                        {
                            "id": "7272364210894970891",
                            "name": "技术中心",
                            "type": "department",
                            "avatar": ""
                        },
                        {
                            "type": "fields",
                            "value": "9527.user",
                            "name": "name",
                            "args": []
                        },
                        {
                            "type": "fields",
                            "value": "9527.users",
                            "name": "name",
                            "args": []
                        }
                    ]
                }
            ],
            "expression_value": null
        }
    }
}
JSON, true));
        $node->setDebug(true);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $operator = $this->getOperator();
        $datetime = new DateTime();
        $triggerData = new TriggerData(
            triggerTime: new DateTime(),
            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname(), $operator->getOrganizationCode())],
            messageInfo: ['message_entity' => TriggerData::createMessageEntity(new TextMessage(['content' => '']))],
            params: [
                'trigger_time' => $datetime->format('Y-m-d H:i:s'),
                'trigger_timestamp' => $datetime->getTimestamp(),
                'branch_id' => '123',
                'routine_config' => json_decode('{"type":"no_repeat","day":"20280903","time":"08:00","value":{"interval":null,"unit":null,"values":null,"deadline":"2029-09-03 08:00:00"},"topic":{"type":"recent_topic","name":{"id":"component-678e06210e35d","version":"1","type":"value","structure":{"type":"const","const_value":[{"type":"input","value":"","name":"","args":null}],"expression_value":null}}}}', true),
            ],
        );
        $executionData = $this->createExecutionData(triggerData: $triggerData, executionType: ExecutionType::Routine);
        $executionData->setFlowCode('MAGIC-FLOW-678ded052eaee2-19893262', '', '');
        $executionData->saveNodeContext('9527', [
            'content' => '你好，你是谁' . time(),
            'user' => [
                'id' => 'usi_a450dd07688be6273b5ef112ad50ba7e',
            ],
            'users' => [
                ['id' => 'usi_a450dd07688be6273b5ef112ad50ba7e1'],
                ['type' => 'user', 'id' => 'usi_a450dd07688be6273b5ef112ad50ba7e2'],
                'usi_a450dd07688be6273b5ef112ad50ba7e3',
            ],
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunImage()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "img",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link_desc": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link_desc",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'link' => 'https://example.tos-cn-beijing.volces.com/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg',
            'link_desc' => '你好，你是谁',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunImageInternal()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "img",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link_desc": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link_desc",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'link' => 'http://localhost/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg',
            'link_desc' => '你好，你是谁',
        ]);
        $node->getNodeDebugResult()->setThrowException(false);
        $runner->execute($vertexResult, $executionData, ['isThrowException' => false]);

        $this->assertFalse($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunImage1()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "img",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link_desc": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link_desc",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->addAttachmentRecord(new Attachment(
            name: '986d7512a979a6ae0a773b2f97d42bba.jpeg',
            url: 'https://example.tos-cn-beijing.volces.com/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg',
            ext: 'jpeg',
            size: 100
        ));
        $executionData->saveNodeContext('9527', [
            'link' => 'https://example.tos-cn-beijing.volces.com/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg',
            'link_desc' => '你好，你是谁',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunImage2()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "img",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link_desc": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link_desc",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->addAttachmentRecord(new ExternalAttachment(
            url: 'https://p9-aiop-sign.byteimg.com/tos-cn-i-vuqhorh59i/202412211551525D871948F089DBC3EEF4-0~tplv-vuqhorh59i-image.image?rk3s=7f9e702d&x-expires=1734853913&x-signature=TkALT50B19ilHZ8+tHbIAFg4DKI=',
        ));
        $executionData->saveNodeContext('9527', [
            'link' => 'https://p9-aiop-sign.byteimg.com/tos-cn-i-vuqhorh59i/202412211551525D871948F089DBC3EEF4-0~tplv-vuqhorh59i-image.image?rk3s=7f9e702d&x-expires=1734853913&x-signature=TkALT50B19ilHZ8+tHbIAFg4DKI=',
            'link_desc' => '你好，你是谁',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunFileOne()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "file",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link_desc": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link_desc",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();

        $executionData->saveNodeContext('9527', [
            'link' => 'https://example.tos-cn-beijing.volces.com/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg',
            'link_desc' => 'xxx.jpeg',
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunFileMore()
    {
        $node = Node::generateTemplate(NodeType::ReplyMessage, json_decode(<<<'JSON'
{
    "type": "file",
    "content": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.content",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link",
                    "name": "",
                    "args": null
                }
            ]
        }
    },
    "link_desc": {
        "id": "component-675bce7fe7691",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "fields",
                    "value": "9527.link_desc",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();

        $executionData->saveNodeContext('9527', [
            'link' => [
                'https://example.tos-cn-beijing.volces.com/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg',
            ],
            'link_desc' => [
                'https://example.tos-cn-beijing.volces.com/MAGIC/test/986d7512a979a6ae0a773b2f97d42bba.jpeg' => 'xxx1.jpeg',
            ],
        ]);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
