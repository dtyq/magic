<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loader;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class ExcelLoaderNodeParamsConfig extends NodeParamsConfig
{
    private Component $files;

    public function getFiles(): Component
    {
        return $this->files;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $files = ComponentFactory::fastCreate($params['files'] ?? [], lazy: true);
        if (! $files?->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'files']);
        }
        $this->files = $files;

        return [
            'files' => $this->files->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'files' => ComponentFactory::generateTemplate(StructureType::Form, json_decode(
                <<<'JSON'
{
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
    "properties": null
}
JSON,
                true
            ))->toArray(),
        ]);

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
            "files_spreadsheet"
        ],
        "properties": {
            "files_spreadsheet": {
                "type": "array",
                "key": "files_spreadsheet",
                "sort": 1,
                "title": "表格文件",
                "description": "",
                "items": {
                    "type": "object",
                    "key": "files_spreadsheet",
                    "sort": 0,
                    "title": "文件",
                    "description": "",
                    "required": [
                        "file_name",
                        "file_url",
                        "file_extension",
                        "sheet"
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
                        "sheets": {
                            "type": "array",
                            "key": "sheets",
                            "sort": 3,
                            "title": "工作表",
                            "description": "",
                            "required": null,
                            "value": null,
                            "items": {
                                "type": "object",
                                "key": "",
                                "sort": 0,
                                "title": "工作表",
                                "description": "",
                                "required": null,
                                "value": null,
                                "items": null,
                                "properties": {
                                    "sheet_name": {
                                        "type": "string",
                                        "key": "sheet_name",
                                        "sort": 0,
                                        "title": "工作表名称",
                                        "description": "",
                                        "required": null,
                                        "value": null,
                                        "items": null,
                                        "properties": null
                                    },
                                    "rows": {
                                        "type": "array",
                                        "key": "rows",
                                        "sort": 1,
                                        "title": "行",
                                        "description": "",
                                        "required": null,
                                        "value": null,
                                        "items": {
                                            "type": "object",
                                            "key": "",
                                            "sort": 0,
                                            "title": "行",
                                            "description": "",
                                            "required": null,
                                            "value": null,
                                            "items": null,
                                            "properties": {
                                                "row_index": {
                                                    "type": "string",
                                                    "key": "row_index",
                                                    "sort": 0,
                                                    "title": "行索引",
                                                    "description": "",
                                                    "required": null,
                                                    "value": null,
                                                    "items": null,
                                                    "properties": null
                                                },
                                                "cells": {
                                                    "type": "array",
                                                    "key": "cells",
                                                    "sort": 0,
                                                    "title": "单元格",
                                                    "description": "",
                                                    "required": null,
                                                    "value": null,
                                                    "items": {
                                                        "type": "object",
                                                        "key": "",
                                                        "sort": 0,
                                                        "title": "列",
                                                        "description": "",
                                                        "required": null,
                                                        "value": null,
                                                        "items": null,
                                                        "properties": {
                                                            "value": {
                                                                "type": "string",
                                                                "key": "value",
                                                                "sort": 0,
                                                                "title": "值",
                                                                "description": "",
                                                                "required": null,
                                                                "value": null,
                                                                "items": null,
                                                                "properties": null
                                                            },
                                                            "column_index": {
                                                                "type": "string",
                                                                "key": "column_index",
                                                                "sort": 1,
                                                                "title": "列索引",
                                                                "description": "",
                                                                "required": null,
                                                                "value": null,
                                                                "items": null,
                                                                "properties": null
                                                            }
                                                        }
                                                    },
                                                    "properties": null
                                                }
                                            }
                                        },
                                        "properties": null
                                    }
                                }
                            },
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
        $this->node->setOutput($output);
    }
}
