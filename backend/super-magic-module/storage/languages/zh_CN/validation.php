<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'file_key_required' => '文件键不能为空',
    'file_name_required' => '文件名不能为空',
    'file_size_required' => '文件大小不能为空',
    'project' => [
        'id' => [
            'required' => '项目ID不能为空',
            'string' => '项目ID必须是字符串',
        ],
        'members' => [
            'required' => '成员列表不能为空',
            'array' => '成员列表必须是数组格式',
            'min' => '至少需要添加一个成员',
            'max' => '成员数量不能超过:max个',
        ],
        'target_type' => [
            'required' => '成员类型不能为空',
            'string' => '成员类型必须是字符串',
            'in' => '成员类型只能是User或Department',
        ],
        'target_id' => [
            'required' => '成员ID不能为空',
            'string' => '成员ID必须是字符串',
            'max' => '成员ID长度不能超过:max个字符',
        ],
    ],
];
