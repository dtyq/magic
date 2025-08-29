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
        ],
        'order' => [
            'frequent' => '常用智能体',
            'all' => '全部智能体',
        ],
        'limit_exceeded' => '智能体数量已达上限（:limit个），无法创建更多',
        'builtin_not_allowed' => '内置智能体不支持此操作',
    ],
];
