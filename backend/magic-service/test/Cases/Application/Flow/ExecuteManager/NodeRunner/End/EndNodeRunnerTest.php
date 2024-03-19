<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\End;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class EndNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::End);
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate([
            'id' => 'component-2',
            'type' => 'form',
            'structure' => [
                'type' => 'object',
                'key' => 'root',
                'sort' => 0,
                'title' => 'root节点',
                'description' => 'root节点',
                'items' => null,
                'value' => null,
                'required' => [
                    'code', 'message',
                ],
                'properties' => [
                    'code' => [
                        'type' => 'number',
                        'key' => 'code',
                        'sort' => 2,
                        'title' => 'code',
                        'description' => 'code',
                        'items' => null,
                        'value' => null,
                        'required' => null,
                        'properties' => null,
                    ],
                    'message' => [
                        'type' => 'string',
                        'key' => 'message',
                        'sort' => 1,
                        'title' => 'message',
                        'description' => 'message',
                        'items' => null,
                        'value' => [
                            'type' => 'expression',
                            'expression_value' => [
                                [
                                    'type' => 'fields',
                                    'value' => '9527.xxx',
                                    'name' => '1',
                                    'args' => null,
                                ],
                            ],
                        ],
                        'required' => null,
                        'properties' => null,
                    ],
                ],
            ],
        ]));
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'xxx' => '嘻嘻',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals([], $vertexResult->getChildrenIds());
        $this->assertEquals('嘻嘻', $executionData->getNodeContext($node->getNodeId())['message']);
    }
}
