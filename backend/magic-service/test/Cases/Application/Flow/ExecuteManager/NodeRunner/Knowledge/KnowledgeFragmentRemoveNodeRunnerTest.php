<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Knowledge;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class KnowledgeFragmentRemoveNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunAny()
    {
        $node = Node::generateTemplate(NodeType::KnowledgeFragmentRemove, json_decode(
            <<<'JSON'
{
    "knowledge_code": "KNOWLEDGE-674d1987228b42-90330502",
    "metadata": {
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
                "organization_code": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": {
                      "type": "expression",
                      "const_value": null,
                      "expression_value": [
                        {
                          "type": "fields",
                          "uniqueId": "9527.organization_code",
                          "value": "9527.organization_code"
                        }
                      ]
                    }
                  }
            }
        }
    }
}
JSON,
            true
        ));

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'organization_code' => 'DT001',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
