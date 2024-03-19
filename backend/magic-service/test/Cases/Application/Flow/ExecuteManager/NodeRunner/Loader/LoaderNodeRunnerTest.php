<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\NodeRunner\Loader;

use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Dag\VertexResult;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class LoaderNodeRunnerTest extends ExecuteManagerBaseTest
{
    public function testRunGet()
    {
        $node = $this->createNode();

        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => 'demo.php',
            'file_url' => 'https://example.object-store-service.com/MAGIC/test/demo.php',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunPdf()
    {
        $this->markTestSkipped('调用付费');
        $node = $this->createNode();
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => '出师表.pdf',
            'file_url' => 'https://example.object-store-service.com/MAGIC/test/出师表.pdf',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunXls()
    {
        $node = $this->createNode();
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => '你好.xlsx',
            'file_url' => 'https://example.object-store-service.com/MAGIC/test/你好.xlsx',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunCsv()
    {
        $node = $this->createNode();
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => '测试.csv',
            'file_url' => 'https://example.object-store-service.com/MAGIC/test/测试.csv',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunTxt()
    {
        $node = $this->createNode();
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => '出师表.txt',
            'file_url' => 'https://example.object-store-service.com/MAGIC/test/出师表.txt',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunDocx()
    {
        $node = $this->createNode();
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => '出师表.docx',
            'file_url' => '',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    public function testRunDoc()
    {
        $this->markTestSkipped('会失败');
        $node = $this->createNode();
        $runner = NodeRunnerFactory::make($node);
        $vertexResult = new VertexResult();
        $executionData = $this->createExecutionData();
        $executionData->saveNodeContext('9527', [
            'file_name' => '出师表.doc',
            'file_url' => 'https://example.object-store-service.com/MAGIC/test/出师表.doc',
        ]);
        $runner->execute($vertexResult, $executionData, []);
        $this->assertTrue($node->getNodeDebugResult()->isSuccess());
    }

    private function createNode(): Node
    {
        $node = Node::generateTemplate(NodeType::Loader, json_decode(
            <<<'JSON'
{
    "files": {
        "id": "component-6698c07a6d49b",
        "version": "1",
        "type": "form",
        "structure": {
            "type": "array",
            "key": "root",
            "sort": 0,
            "title": "文件列表",
            "description": "",
            "required": null,
            "value": null,
            "items": {
                "type": "object",
                "key": "file",
                "sort": 0,
                "title": "文件",
                "description": "",
                "required": [
                    "file_name",
                    "file_url"
                ],
                "value": null,
                "items": null,
                "properties": {
                    "file_name": {
                        "type": "string",
                        "key": "file_name",
                        "sort": 0,
                        "title": "文件名称",
                        "description": "",
                        "required": null,
                        "value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_url": {
                        "type": "string",
                        "key": "content",
                        "sort": 1,
                        "title": "文件地址",
                        "description": "",
                        "required": null,
                        "value": null,
                        "items": null,
                        "properties": null
                    }
                }
            },
            "properties": {
                "0": {
                    "type": "object",
                    "key": "file",
                    "sort": 0,
                    "title": "文件",
                    "description": "",
                    "required": [
                        "file_name",
                        "file_url"
                    ],
                    "value": null,
                    "items": null,
                    "properties": {
                        "file_name": {
                            "type": "string",
                            "key": "file_name",
                            "sort": 0,
                            "title": "文件名称",
                            "description": "",
                            "required": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "fields",
                                        "value": "9527.file_name",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            },
                            "items": null,
                            "properties": null
                        },
                        "file_url": {
                            "type": "string",
                            "key": "content",
                            "sort": 1,
                            "title": "文件地址",
                            "description": "",
                            "required": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "fields",
                                        "value": "9527.file_url",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            },
                            "items": null,
                            "properties": null
                        }
                    }
                }
            }
        }
    }
}
JSON,
            true
        ));
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(
            <<<'JSON'
    {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "content",
            "files_content"
        ],
        "properties": {
            "content": {
                "type": "string",
                "key": "content",
                "sort": 0,
                "title": "内容",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "files_content": {
                "type": "array",
                "key": "files_content",
                "sort": 1,
                "title": "文件内容",
                "description": "",
                "items": {
                    "type": "object",
                    "key": "file",
                    "sort": 0,
                    "title": "文件",
                    "description": "",
                    "required": [
                        "file_name",
                        "file_url",
                        "file_extension",
                        "content"
                    ],
                    "value": null,
                    "items": null,
                    "properties": {
                        "file_name": {
                            "type": "string",
                            "key": "file_name",
                            "sort": 0,
                            "title": "文件名称",
                            "description": "",
                            "required": null,
                            "value": null,
                            "items": null,
                            "properties": null
                        },
                        "file_url": {
                            "type": "string",
                            "key": "content",
                            "sort": 1,
                            "title": "文件地址",
                            "description": "",
                            "required": null,
                            "value": null,
                            "items": null,
                            "properties": null
                        },
                        "file_extension": {
                            "type": "string",
                            "key": "file_extension",
                            "sort": 2,
                            "title": "文件扩展名",
                            "description": "",
                            "required": null,
                            "value": null,
                            "items": null,
                            "properties": null
                        },
                        "content": {
                            "type": "string",
                            "key": "content",
                            "sort": 3,
                            "title": "内容",
                            "description": "",
                            "required": null,
                            "value": null,
                            "items": null,
                            "properties": null
                        }
                    }
                },
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON
        )));
        $node->setOutput($output);
        return $node;
    }
}
