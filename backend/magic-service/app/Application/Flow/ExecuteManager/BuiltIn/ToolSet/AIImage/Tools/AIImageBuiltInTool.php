<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AIImage\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class AIImageBuiltInTool extends AbstractAIImageBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AIImage->getCode();
    }

    public function getName(): string
    {
        return 'ai_image';
    }

    public function getDescription(): string
    {
        return '文生图工具';
    }

    public function getCallback(): ?Closure
    {
        // 可接受参数指定任意 model，默认是火山。
        return function (ExecutionData $executionData) {
            $args = $executionData->getTriggerData()?->getParams();
            $model = $args['model'] ?? ImageGenerateModelType::Volcengine->value;
            $this->executeCallback($executionData, $model);
        };
    }

    public function getInput(): ?NodeInput
    {
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
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
        "user_prompt"
    ],
    "properties": {
        "model": {
            "type": "string",
            "key": "model",
            "title": "所使用的文生图模型",
            "description": "可选：Volcengine,Midjourney,Flux1-Schnell,默认Volcengine,TTAPI-GPT4o",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "radio": {
            "type": "string",
            "key": "radio",
            "title": "生成图片的比例",
            "description": "可选：\"1:1\",\"2:3\",\"4:3\",\"9:16\",\"16:9\",默认\"1:1\"",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "user_prompt": {
            "type": "string",
            "key": "user_prompt",
            "title": "用户提示词",
            "description": "用户提示词",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "reference_image_ids": {
            "type": "array",
            "key": "reference_image_ids",
            "title": "引用的图片id列表",
            "description": "引用的图片id列表",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "string",
                "key": "reference_image_id",
                "sort": 0,
                "title": "reference_image_id",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            },
            "properties": null
        },
        "attachments": {
            "type": "array",
            "key": "attachments",
            "title": "附件数组",
            "description": "传入文件列表数组",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "object",
                "key": "files",
                "sort": 0,
                "title": "文件",
                "description": "",
                "required": [
                ],
                "value": null,
                "encryption": false,
                "encryption_value": null,
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
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_url": {
                        "type": "string",
                        "key": "file_url",
                        "sort": 1,
                        "title": "文件地址",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_ext": {
                        "type": "string",
                        "key": "file_ext",
                        "sort": 2,
                        "title": "文件后缀",
                        "description": "",
                        "required": null,
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                    "file_size": {
                        "type": "number",
                        "key": "file_size",
                        "sort": 3,
                        "title": "文件大小",
                        "description": "",
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
JSON,
            true
        )));
        return $input;
    }
}
