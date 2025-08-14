<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Variable;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class VariableSetNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::VariableSet, json_decode(<<<'JSON'
{
    "variables": {
        "form": {
            "id": "component-66dfddf51af18",
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
                    "var1" : {
                        "type": "string",
                        "key": "var1",
                        "sort": 0,
                        "title": null,
                        "description": null,
                        "required": [],
                        "value": {
                            "type": "expression",
                            "const_value": null,
                            "expression_value": [
                                {
                                    "type": "fields",
                                    "value": "9527.var1",
                                    "name": "9527.var1",
                                    "args": null
                                }
                            ]
                        },
                        "items": null,
                        "properties": null
                    },
                    "var2" : {
                        "type": "array",
                        "key": "var1",
                        "sort": 0,
                        "title": null,
                        "description": null,
                        "required": [],
                        "value": {
                            "type": "expression",
                            "const_value": null,
                            "expression_value": [
                                {
                                    "type": "fields",
                                    "value": "9527.var2",
                                    "name": "9527.var2",
                                    "args": null
                                }
                            ]
                        },
                        "items": null,
                        "properties": null
                    }
                }
            }
        },
        "page": null
    }
}
JSON, true));

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'var1' => 'value777',
            'var2' => ['value777'],
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals([
            'var1' => 'value777',
            'var2' => ['value777'],
        ], $executionData->getVariables());
    }
}
