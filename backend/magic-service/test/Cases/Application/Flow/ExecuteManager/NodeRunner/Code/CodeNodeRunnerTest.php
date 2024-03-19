<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Code;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Dtyq\FlowExprEngine\ComponentFactory;
use Hyperf\Codec\Json;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class CodeNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunPHP()
    {
        $node = Node::generateTemplate(NodeType::Code, [
            'language' => 'php',
            'code' => <<<'PHP'
var_dump(123);
        if ($yes) {
            return [
                'result' => 'ok',
            ];
        } else {
            return [
                'result' => 'no',
            ];
        }
PHP,
        ]);
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(Json::decode(<<<'JSON'
{
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "yes"
        ],
        "properties": {
            "yes": {
                "type": "string",
                "key": "yes",
                "sort": 0,
                "title": "yes",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": {
                    "type": "expression",
                    "expression_value": [
                        {
                            "type": "fields",
                            "value": "9527.yes",
                            "name": "yes",
                            "args": null
                        }
                    ],
                    "const_value": null
                }
            }
        }
    }
}
JSON)));
        $node->setInput($input);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(Json::decode(
            <<<'JSON'
{
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "result"
        ],
        "properties": {
            "result": {
                "type": "string",
                "key": "result",
                "sort": 0,
                "title": "result",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
}
JSON
        )));
        $node->setOutput($output);
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'yes' => 'yes',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        var_dump($vertexResult->getResult());
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals('ok', $executionData->getNodeContext($node->getNodeId())['result']);
    }

    public function testRunPython()
    {
        $node = Node::generateTemplate(NodeType::Code, [
            'language' => 'python',
            'code' => <<<'PYTHON'
print(123)
if yes:
    return {
        'result': 'ok'
    }
else:
    return {
        'result': 'no'
    }
PYTHON,
        ]);
        $input = new NodeInput();
        $input->setForm(ComponentFactory::fastCreate(Json::decode(<<<'JSON'
{
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "yes"
        ],
        "properties": {
            "yes": {
                "type": "string",
                "key": "yes",
                "sort": 0,
                "title": "yes",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": {
                    "type": "expression",
                    "expression_value": [
                        {
                            "type": "fields",
                            "value": "9527.yes",
                            "name": "yes",
                            "args": null
                        }
                    ],
                    "const_value": null
                }
            }
        }
    }
}
JSON)));
        $node->setInput($input);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(Json::decode(
            <<<'JSON'
{
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "result"
        ],
        "properties": {
            "result": {
                "type": "string",
                "key": "result",
                "sort": 0,
                "title": "result",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
}
JSON
        )));
        $node->setOutput($output);
        $node->validate();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'yes' => 'yes',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        var_dump($vertexResult->getResult());
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
        $this->assertEquals('ok', $executionData->getNodeContext($node->getNodeId())['result']);
    }
}
