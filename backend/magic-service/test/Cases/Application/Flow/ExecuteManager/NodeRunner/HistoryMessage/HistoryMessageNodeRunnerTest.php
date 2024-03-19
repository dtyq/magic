<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\HistoryMessage;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class HistoryMessageNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::HistoryMessage, [
            'max_record' => 10,
        ]);
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-66a0650de155f",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "history_messages"
        ],
        "value": null,
        "items": null,
        "properties": {
            "history_messages": {
                "type": "array",
                "key": "history_messages",
                "sort": 0,
                "title": "历史消息",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "object",
                    "key": "history_messages",
                    "sort": 0,
                    "title": "历史消息",
                    "description": "",
                    "required": [
                        "role",
                        "content"
                    ],
                    "value": null,
                    "items": null,
                    "properties": {
                        "role": {
                            "type": "string",
                            "key": "role",
                            "sort": 0,
                            "title": "角色",
                            "description": "",
                            "required": null,
                            "value": null,
                            "items": null,
                            "properties": null
                        },
                        "content": {
                            "type": "string",
                            "key": "content",
                            "sort": 1,
                            "title": "内容",
                            "description": "",
                            "required": null,
                            "value": null,
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
        $node->setOutput($output);
        $node->validate();

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {
        //            $result = [
        //                'history_messages' => ['a'],
        //            ];
        //            $vertexResult->setResult($result);
        //        });

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData(triggerType: TriggerType::ChatMessage, executionType: ExecutionType::IMChat);
        $executionData->setOriginConversationId('715320715409252352');
        $executionData->setTopicId('722538921486815233');
        $runner->execute($vertexResult, $executionData, []);
        $this->assertArrayHasKey('history_messages', $vertexResult->getResult());
    }
}
