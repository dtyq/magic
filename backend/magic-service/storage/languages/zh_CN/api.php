<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Token相关错误
    'token' => [
        'not_exist' => 'API令牌不存在',
        'expired' => 'API令牌已过期',
        'model_not_support' => '令牌不支持此模型',
        'organization_not_support' => '令牌不支持此组织',
        'ip_not_in_white_list' => 'IP地址不在白名单中',
        'quota_not_enough' => '令牌配额不足',
        'calculate_error' => '令牌计算错误',
        'create_error' => '创建令牌失败',
    ],

    // 模型相关错误
    'model' => [
        'not_support' => '不支持该模型',
        'response_fail' => '模型响应失败',
    ],

    // 组织相关错误
    'organization' => [
        'quota_not_enough' => '组织配额不足',
    ],

    // 消息相关错误
    'message' => [
        'empty' => '消息不能为空',
    ],

    // 用户相关错误
    'user' => [
        'create_access_token_limit' => '用户创建访问令牌数量超过限制',
        'use_access_token_limit' => '用户使用访问令牌数量超过限制',
        'create_access_token_rate_limit' => '用户创建访问令牌频率受限',
    ],

    // 通用错误
    'rate_limit' => '请求频率超限',
    'msg_empty' => '消息为空',
    'user_id_not_exist' => '用户ID不存在',
    'validate_failed' => '验证失败',
];
