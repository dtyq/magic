<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'fields' => [
        'code' => '代码',
        'name' => '名称',
        'description' => '描述',
        'status' => '状态',
        'external_sse_url' => 'MCP 服务地址',
        'url' => 'URL',
        'command' => '命令',
        'arguments' => '参数',
        'headers' => '请求头',
        'env' => '环境变量',
        'oauth2_config' => 'OAuth2配置',
        'client_id' => '客户端ID',
        'client_secret' => '客户端密钥',
        'client_url' => '客户端URL',
        'scope' => '授权范围',
        'authorization_url' => '授权URL',
        'authorization_content_type' => '授权内容类型',
        'issuer_url' => '发行方URL',
        'redirect_uri' => '重定向URI',
        'use_pkce' => '使用PKCE',
        'response_type' => '响应类型',
        'grant_type' => '授权类型',
        'additional_params' => '附加参数',
        'created_at' => '创建时间',
        'updated_at' => '更新时间',
    ],
    'auth_type' => [
        'none' => '无认证',
        'oauth2' => 'OAuth2认证',
    ],

    // 错误消息
    'validate_failed' => '验证失败',
    'not_found' => '数据不存在',

    // 服务相关错误
    'service' => [
        'already_exists' => 'MCP服务已存在',
        'not_enabled' => 'MCP服务未启用',
    ],

    // 服务器相关错误
    'server' => [
        'not_support_check_status' => '不支持此类型的服务器状态检查',
    ],

    // 资源关联错误
    'rel' => [
        'not_found' => '关联资源不存在',
        'not_enabled' => '关联资源未启用',
    ],
    'rel_version' => [
        'not_found' => '关联资源版本不存在',
    ],

    // 工具错误
    'tool' => [
        'execute_failed' => '工具执行失败',
    ],

    // OAuth2认证错误
    'oauth2' => [
        'authorization_url_generation_failed' => '生成OAuth2授权URL失败',
        'callback_handling_failed' => '处理OAuth2回调失败',
        'token_refresh_failed' => '刷新OAuth2令牌失败',
        'invalid_response' => 'OAuth2提供商响应无效',
        'provider_error' => 'OAuth2提供商返回错误',
        'missing_access_token' => '未从OAuth2提供商获得访问令牌',
        'invalid_service_configuration' => '无效的OAuth2服务配置',
        'missing_configuration' => '缺少OAuth2配置',
        'not_authenticated' => '此服务未找到OAuth2身份验证',
        'no_refresh_token' => '没有可用于令牌刷新的刷新令牌',
        'binding' => [
            'code_empty' => '授权码不能为空',
            'state_empty' => '状态参数不能为空',
            'mcp_server_code_empty' => 'MCP服务代码不能为空',
        ],
    ],

    // 命令验证错误
    'command' => [
        'not_allowed' => '不支持的命令 ":command"，当前仅支持: :allowed_commands',
    ],

    // 必填字段验证错误
    'required_fields' => [
        'missing' => '必填字段缺失: :fields',
        'empty' => '必填字段不能为空: :fields',
    ],

    // STDIO执行器相关错误
    'executor' => [
        'stdio' => [
            'connection_failed' => 'STDIO执行器连接失败',
            'access_denied' => '暂时不支持STDIO执行器功能',
        ],
        'http' => [
            'connection_failed' => 'HTTP执行器连接失败',
        ],
    ],
];
