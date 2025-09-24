<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'param_error' => '参数错误',
    'not_found' => '插件未找到',
    'name' => [
        'required' => '插件名称是必填项',
    ],
    'description' => [
        'required' => '插件描述是必填项',
    ],
    'type' => [
        'required' => '插件类型是必填项',
        'modification_not_allowed' => '插件类型不允许修改',
    ],
    'creator' => [
        'required' => '创建者是必填项',
    ],
    'api_config' => [
        'required' => '接口配置是必填项',
        'api_url' => [
            'required' => 'API地址是必填项',
            'invalid' => 'API地址无效',
        ],
        'auth_type' => [
            'required' => '认证类型是必填项',
        ],
        'auth_config' => [
            'invalid' => '认证配置无效',
        ],
    ],
];
