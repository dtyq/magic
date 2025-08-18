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
class FileGetLinkBuiltInTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::FileBox->getCode();
    }

    public function getName(): string
    {
        return 'get_link';
    }

    public function getDescription(): string
    {
        return '根据文件 key 获取文件下载的签名URL。仅能获取本流程产生的文件';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();

            $key = $params['key'] ?? '';
            if (empty($key)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.empty', ['label' => 'key']);
            }

            $organizationCode = $executionData->getDataIsolation()->getCurrentOrganizationCode();

            // key 权限检测
            if (! str_starts_with($key, $organizationCode . '/' . config('kk_brd_service.app_id') . '/' . $executionData->getParentFlowCode())) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'common.access', ['label' => $key]);
            }

            $fileDomain = di(FileDomainService::class);
            $file = $fileDomain->getLink($organizationCode, $key);

            return [
                'url' => $file->getUrl(),
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
        "key"
    ],
    "properties": {
        "key": {
            "type": "string",
            "key": "key",
            "title": "文件key",
            "description": "文件key",
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
        "url"
    ],
    "properties": {
        "url": {
            "type": "string",
            "key": "url",
            "title": "文件url",
            "description": "文件可访问链接",
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
