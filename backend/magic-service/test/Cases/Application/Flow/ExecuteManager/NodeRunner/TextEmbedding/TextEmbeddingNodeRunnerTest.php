<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\TextEmbedding;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class TextEmbeddingNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::TextEmbedding);
        $node->setParams(json_decode(<<<'JSON'
{
    "embedding_model": "dmeta-embedding",
    "text": {
        "id": "component-66973b9c13cf7",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "const_value": null,
            "expression_value": [
                {
                    "type": "input",
                    "value": "嘻嘻哈哈",
                    "name": "",
                    "args": null
                }
            ]
        }
    }
}
JSON, true));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(<<<'JSON'
{
    "id": "component-669a12a274784",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "required": [
            "embeddings"
        ],
        "value": null,
        "items": null,
        "properties": {
            "embeddings": {
                "type": "array",
                "key": "embeddings",
                "sort": 0,
                "title": "向量",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "number",
                    "key": "0",
                    "sort": 0,
                    "title": "向量",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            }
        }
    }
}
JSON, true)));
        $node->setOutput($output);

        $node->validate();

        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {
            $result = [
                'embeddings' => [1, 2],
            ];

            $vertexResult->setResult($result);
        });

        $runner = MagicFlowExecutor::getNodeRunner($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertArrayHasKey('embeddings', $vertexResult->getResult());
    }
}
