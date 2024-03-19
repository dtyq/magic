<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\BuiltIn\ToolSet\AtomicNode\Tools;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class GetMimeOauthTokenToolTest extends ExecuteManagerBaseTest
{
    public function testRunByTool()
    {
        $node = Node::generateTemplate(NodeType::Tool, [
            'tool_id' => 'atomic_node_get_mime_oauth_token',
            'mode' => 'parameter',
            'async' => false,
            'custom_system_input' => null,
        ]);
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);

        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $runner->execute($vertexResult, $executionData, []);

        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
