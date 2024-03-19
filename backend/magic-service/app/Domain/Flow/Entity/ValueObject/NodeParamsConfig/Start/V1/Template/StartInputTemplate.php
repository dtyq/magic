<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\V1\Template;

use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class StartInputTemplate
{
    public static function getChatMessageInputKeys(): array
    {
        return [
            'conversation_id',
            'topic_id',
            'message_content',
            'message_type',
            'message_time',
            'organization_code',
            'files',
            'user',
            'bot_key',
        ];
    }

    public static function getChatMessageInputTemplateComponent(): Component
    {
        $formJson = <<<'JSON'
{
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "conversation_id",
            "topic_id",
            "message_content",
            "message_type",
            "message_time",
            "organization_code",
            "user",
            "bot_key"
        ],
        "properties": {
            "conversation_id": {
                "type": "string",
                "key": "conversation_id",
                "title": "会话 ID",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "topic_id": {
                "type": "string",
                "key": "topic_id",
                "title": "话题 ID",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "message_content": {
                "type": "string",
                "key": "message_content",
                "title": "消息内容",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "message_type": {
                "type": "string",
                "key": "message_type",
                "title": "消息类型",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "message_time": {
                "type": "string",
                "key": "message_time",
                "title": "发送时间",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "organization_code": {
                "type": "string",
                "key": "organization_code",
                "title": "组织编码",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            },
            "files": {
                "type": "array",
                "key": "files",
                "title": "文件列表",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": {
                    "type": "object",
                    "key": "files",
                    "title": "文件",
                    "description": "",
                    "required": [
                        "name",
                        "url",
                        "extension",
                        "size"
                    ],
                    "value": null,
                    "encryption": false,
                    "encryption_value": null,
                    "items": null,
                    "properties": {
                        "name": {
                            "type": "string",
                            "key": "name",
                            "title": "文件名称",
                            "description": "",
                            "required": null,
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": null
                        },
                        "url": {
                            "type": "string",
                            "key": "url",
                            "title": "文件链接",
                            "description": "",
                            "required": null,
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": null
                        },
                        "extension": {
                            "type": "string",
                            "key": "extension",
                            "title": "文件扩展名",
                            "description": "",
                            "required": null,
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": null
                        },
                        "size": {
                            "type": "number",
                            "key": "size",
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
            },
            "user": {
                "type": "object",
                "key": "user",
                "title": "用户",
                "description": "",
                "items": null,
                "required": [
                    "id",
                    "nickname",
                    "real_name",
                    "position",
                    "phone_number",
                    "work_number"
                ],
                "properties": {
                    "id": {
                        "type": "string",
                        "key": "id",
                        "title": "用户 ID",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "value": null
                    },
                    "nickname": {
                        "type": "string",
                        "key": "nickname",
                        "title": "用户昵称",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "value": null
                    },
                    "real_name": {
                        "type": "string",
                        "key": "real_name",
                        "title": "真实姓名",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "value": null
                    },
                    "position": {
                        "type": "string",
                        "key": "position",
                        "title": "岗位",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": null
                    },
                    "work_number": {
                        "type": "string",
                        "key": "work_number",
                        "title": "工号",
                        "description": "",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": null
                    },
                    "departments": {
                        "type": "array",
                        "key": "departments",
                        "title": "部门",
                        "description": "desc",
                        "required": [],
                        "encryption": false,
                        "encryption_value": null,
                        "items": {
                            "type": "object",
                            "key": "departments",
                            "sort": 0,
                            "title": "部门",
                            "description": "desc",
                            "required": [
                                "id",
                                "name",
                                "path"
                            ],
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "title": "部门 ID",
                                    "description": "",
                                    "key": "id",
                                    "items": null,
                                    "properties": null,
                                    "required": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "value": null
                                },
                                "name": {
                                    "type": "string",
                                    "title": "部门名称",
                                    "description": "",
                                    "key": "name",
                                    "items": null,
                                    "properties": null,
                                    "required": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "value": null
                                },
                                "path": {
                                    "type": "string",
                                    "title": "部门路径",
                                    "description": "",
                                    "key": "path",
                                    "items": null,
                                    "properties": null,
                                    "required": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "value": null
                                }
                            },
                            "value": null
                        },
                        "properties": null,
                        "value": null
                    }
                },
                "value": null
            },
            "bot_key": {
                "type": "string",
                "key": "bot_key",
                "title": "第三方聊天机器人编码",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON;
        return ComponentFactory::generateTemplate(StructureType::Form, json_decode($formJson, true));
    }
}
