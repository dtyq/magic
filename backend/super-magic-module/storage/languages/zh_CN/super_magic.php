<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'agent' => [
        'fields' => [
            'code' => '编码',
            'codes' => '编码列表',
            'name' => '名称',
            'description' => '描述',
            'icon' => '图标',
            'type' => '类型',
            'enabled' => '启用状态',
            'prompt' => '提示词',
            'tools' => '工具配置',
            'tool_code' => '工具编码',
            'tool_name' => '工具名称',
            'tool_type' => '工具类型',
        ],
        'validation' => [
            // 基本字段验证
            'name_required' => '智能体名称不能为空',
            'name_string' => '智能体名称必须是字符串',
            'name_max' => '智能体名称不能超过80个字符',
            'description_string' => '智能体描述必须是字符串',
            'description_max' => '智能体描述不能超过512个字符',
            'icon_string' => '智能体图标必须是字符串',
            'icon_max' => '智能体图标不能超过100个字符',
            'type_integer' => '智能体类型必须是整数',
            'type_invalid' => '智能体类型不合法',
            'enabled_boolean' => '启用状态必须是布尔值',
            'prompt_required' => '智能体提示词不能为空',
            'prompt_array' => '智能体提示词必须是数组格式',
            'tools_array' => '工具配置必须是数组格式',

            // 工具字段验证
            'tool_code_required' => '工具编码不能为空',
            'tool_code_string' => '工具编码必须是字符串',
            'tool_code_max' => '工具编码不能超过100个字符',
            'tool_name_required' => '工具名称不能为空',
            'tool_name_string' => '工具名称必须是字符串',
            'tool_name_max' => '工具名称不能超过100个字符',
            'tool_description_string' => '工具描述必须是字符串',
            'tool_description_max' => '工具描述不能超过2048个字符',
            'tool_icon_string' => '工具图标必须是字符串',
            'tool_icon_max' => '工具图标不能超过512个字符',
            'tool_type_required' => '工具类型不能为空',
            'tool_type_integer' => '工具类型必须是整数',
            'tool_type_invalid' => '工具类型不合法',
        ],
        'order' => [
            'frequent' => '常用智能体',
            'all' => '全部智能体',
        ],
        'limit_exceeded' => '智能体数量已达上限（:limit个），无法创建更多',
        'builtin_not_allowed' => '内置智能体不支持此操作',
    ],
];
