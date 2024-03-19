<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Infrastructure\Core\Dag\VertexResult;

/**
 * @internal
 */
class MagicFlowExecutorTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $nodes = [];
        $nodeTypes = NodeType::cases();
        foreach ($nodeTypes as $i => $nodeType) {
            $node = new Node($nodeType);
            $node->setNodeId('node_' . $i);
            $node->setName($nodeType->name);
            if (isset($nodeTypes[$i + 1])) {
                $node->setNextNodes(['node_' . ($i + 1)]);
            }
            $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $frontResults) {});
            $nodes[$i] = $node;
        }
        $magicFlowEntity = $this->getMagicFlowEntity();
        $magicFlowEntity->setNodes($nodes);

        $executionData = $this->createExecutionData(TriggerType::ChatMessage);
        $executor = new MagicFlowExecutor($magicFlowEntity, $executionData);

        $executor->execute();
        foreach ($nodes as $node) {
            $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        }
    }

    private function getMagicFlowEntity(): MagicFlowEntity
    {
        $magicFlowEntity = new MagicFlowEntity();
        $magicFlowEntity->setCode('unit_test.' . uniqid());
        $magicFlowEntity->setName('unit_test');
        $magicFlowEntity->setType(Type::Main);
        $magicFlowEntity->setCreator('system_unit');
        return $magicFlowEntity;
    }
}
