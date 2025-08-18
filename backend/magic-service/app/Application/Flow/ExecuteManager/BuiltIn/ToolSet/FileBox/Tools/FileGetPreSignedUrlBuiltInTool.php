<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\FileBox\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class FileGetPreSignedUrlBuiltInTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::FileBox->getCode();
    }

    public function getName(): string
    {
        return 'get_pre_signed_url';
    }

    public function getDescription(): string
    {
        return '根据文件名获取文件上传的预签名URL。仅能操作本流程产生的文件';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();

            $name = $params['name'];
            if (empty($name)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.empty', ['label' => 'name']);
            }
            $organizationCode = $executionData->getDataIsolation()->getCurrentOrganizationCode();

            // 权限问题，目前仅允许操作本流程产生的文件。因为当前工具也是一个 flow，所以需要获取父流程的 code
            $name = $executionData->getParentFlowCode() . '/' . ltrim($name, '/');

            $fileDomain = di(FileDomainService::class);
            $preSignedUrl = $fileDomain->getPreSignedUrls($organizationCode, [$name])[$name] ?? null;
            if (! $preSignedUrl) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'file.not_found', ['name' => $name]);
            }
            return [
                'url' => $preSignedUrl->getUrl(),
                'headers' => $preSignedUrl->getHeaders(),
                'expires' => $preSignedUrl->getExpires(),
                'key' => $preSignedUrl->getPath(),
                'name' => $name,
            ];
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
        "name"
    ],
    "properties": {
        "name": {
            "type": "string",
            "key": "name",
            "title": "文件名",
            "description": "文件名称",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $input;
    }

    public function getOutPut(): ?NodeOutput
    {
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
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
        "url",
        "headers",
        "expires",
        "key",
        "name"
    ],
    "properties": {
        "url": {
            "type": "string",
            "key": "url",
            "title": "URL",
            "description": "文件上传的预签名URL",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "headers": {
            "type": "object",
            "key": "headers",
            "title": "Headers",
            "description": "文件上传的预签名URL的Headers",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "expires": {
            "type": "number",
            "key": "expires",
            "title": "过期时间",
            "description": "文件上传的预签名URL的过期时间",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "key": {
            "type": "string",
            "key": "key",
            "title": "key",
            "description": "文件的完整Key",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "name": {
            "type": "string",
            "key": "name",
            "title": "文件名",
            "description": "文件名",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $output;
    }
}
