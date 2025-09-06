<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\ImageGenerate;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Connector\Component\ComponentFactory;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;
use Throwable;

/**
 * @internal
 */
class ImageGenerateNodeRunnerTest extends ExecuteManagerBaseTest
{
    /**
     * @throws Throwable
     */
    public function testRunMidjourney()
    {
        //        $this->markTestSkipped();
        $node = Node::generateTemplate(NodeType::ImageGenerate, json_decode(<<<'JSON'
{
    "model": "Midjourney",
    "height": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": "4"
                }
            ]
        }
    },
    "wide": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": "3"
                }
            ]
        }
    },
    "user_prompt": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": "Help me generate a brave and handsome lion. fantasy Illustration. award winning, Artstation, intricate details, realistic, Hyperdetailed, 8k resolution. Smooth. In the style of David Firth."
                }
            ]
        }
    },
    "negative_prompt": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": ""
                }
            ]
        }
    }
}
JSON, true));

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(
            <<<'JSON'
{
    "id": "component-662617c744ed6",
    "version": "1",
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
            "images"
        ],
        "properties": {
            "images": {
                "type": "array",
                "key": "images",
                "sort": 0,
                "title": "图片数据",
                "description": "",
                "items": {
                    "type": "string",
                    "key": "",
                    "sort": 0,
                    "title": "图片链接",
                    "description": "",
                    "items": null,
                    "properties":null, 
                    "required": null,
                    "value": null
                },
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
}
JSON,
            true
        )));
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', []);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertIsArray($vertexResult->getResult()['images']);
    }

    /**
     * @throws Throwable
     */
    public function testRunVolcengine()
    {
        $node = Node::generateTemplate(NodeType::ImageGenerate, json_decode(<<<'JSON'
{
    "model": "Volcengine",
    "height": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": "1920"
                }
            ]
        }
    },
    "wide": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": "1080"
                }
            ]
        }
    },
    "user_prompt": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": "Help me generate a brave and handsome lion. fantasy Illustration. award winning, Artstation, intricate details, realistic, Hyperdetailed, 8k resolution. Smooth. In the style of David Firth."
                }
            ]
        }
    },
    "negative_prompt": {
        "id": "component-663c6d3ed0aa4",
        "version": "1",
        "type": "value",
        "structure": {
            "type": "expression",
            "expression_value": [
                {
                    "type": "input",
                    "uniqueId": "653588291282538497",
                    "value": ""
                }
            ]
        }
    }
}
JSON, true));

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::fastCreate(json_decode(
            <<<'JSON'
{
    "id": "component-662617c744ed6",
    "version": "1",
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
            "images"
        ],
        "properties": {
            "images": {
                "type": "array",
                "key": "images",
                "sort": 0,
                "title": "图片数据",
                "description": "",
                "items": {
                    "type": "string",
                    "key": "",
                    "sort": 0,
                    "title": "图片链接",
                    "description": "",
                    "items": null,
                    "properties":null, 
                    "required": null,
                    "value": null
                },
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
}
JSON,
            true
        )));
        $node->setOutput($output);

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', []);
        $runner->execute($vertexResult, $executionData, []);

        $this->assertIsArray($vertexResult->getResult()['images']);
    }
}
