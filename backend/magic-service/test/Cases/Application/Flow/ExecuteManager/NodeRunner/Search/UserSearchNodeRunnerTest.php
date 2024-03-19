<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Search;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
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
class UserSearchNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRun()
    {
        $node = Node::generateTemplate(NodeType::UserSearch, json_decode(<<<'JSON'
{
    "filter_type": "any",
    "filters": [
        {
            "left": "username",
            "operator": "equals",
            "right": {
                "id": "component-663c6d64b33d4",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "小明",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            }
        },
        {
            "left": "phone",
            "operator": "equals",
            "right": {
                "id": "component-663c6d64b33d4",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "13800138000",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            }
        }
    ]
}

JSON, true));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(
            <<<'JSON'
{
    "id": "component-662617a69868d",
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
            "output": {
                "type": "string",
                "key": "output",
                "sort": 0,
                "title": "输出",
                "description": "",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON,
            true
        )));
        $node->setOutput($output);
        $node->validate();

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunDept()
    {
        $node = Node::generateTemplate(NodeType::UserSearch, json_decode(<<<'JSON'
{
    "filter_type": "any",
    "filters": [
        {
            "left": "department_name",
            "operator": "equals",
            "right": {
                "id": "component-663c6d64b33d4",
                "version": "1",
                "type": "value",
                "structure": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "input",
                            "value": "技术中心",
                            "name": "",
                            "args": null
                        }
                    ]
                }
            }
        }
    ]
}

JSON, true));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(
            <<<'JSON'
{
    "id": "component-662617a69868d",
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
            "output": {
                "type": "string",
                "key": "output",
                "sort": 0,
                "title": "输出",
                "description": "",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            }
        }
    }
}
JSON,
            true
        )));
        $node->setOutput($output);
        $node->validate();

        //        $node->setCallback(function (VertexResult $vertexResult, ExecutionData $executionData, array $fontResults) {});

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }
}
