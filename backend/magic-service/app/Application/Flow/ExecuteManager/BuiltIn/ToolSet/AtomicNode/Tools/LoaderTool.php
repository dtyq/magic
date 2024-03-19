<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AtomicNode\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunnerFactory;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use Closure;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class LoaderTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AtomicNode->getCode();
    }

    public function getName(): string
    {
        return 'document_parse';
    }

    public function getDescription(): string
    {
        return '文档解析。用于解析远程文档中内容，提取文档中的内容输出。';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();

            $node = Node::generateTemplate(NodeType::Loader, [], 'latest');
            /** @var null|Component $fileComponent */
            $fileComponent = ComponentFactory::fastCreate($node->getParams()['files'] ?? []);
            if (! $fileComponent?->isForm()) {
                return null;
            }
            $fileComponent->getForm()->appendConstValue($params['files'] ?? []);
            $node->setParams([
                'files' => $fileComponent,
            ]);

            $runner = NodeRunnerFactory::make($node);
            $vertexResult = new VertexResult();
            $runner->execute($vertexResult, clone $executionData);
            return $vertexResult->getResult();
        };
    }

    public function getInput(): ?NodeInput
    {
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(<<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "",
    "required": [
        "files"
    ],
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "items": null,
    "properties": {
        "files": {
            "type": "array",
            "key": "files",
            "title": "文件",
            "description": "",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "object",
                "key": "file",
                "sort": 0,
                "title": "文件",
                "description": "",
                "required": [
                    "file_url"
                ],
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": {
                    "file_name": {
                        "type": "string",
                        "key": "file_name",
                        "title": "文件名称",
                        "description": "文件名称。没有时可使用 url 中的文件名",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_url": {
                        "type": "string",
                        "key": "file_url",
                        "title": "文件地址。远程文件地址",
                        "description": "文件地址。远程文件地址",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    }
                }
            },
            "properties": null
        }
    }
}
JSON, true)));
        return $input;
    }
}
