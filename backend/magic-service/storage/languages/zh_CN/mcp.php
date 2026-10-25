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
        'icon' => '图标',
        'status' => '状态',
        'external_sse_url' => 'MCP 服务地址',
        'url' => 'URL',
        'command' => '命令',
        'arguments' => '参数',
        'headers' => '请求头',
        'env' => '环境变量',
        'oauth2_config' => 'OAuth2配置',
        'mcp_authorization_config' => 'MCP标准授权配置',
        'client_id' => '客户端ID',
        'client_secret' => '客户端密钥',
        'client_url' => '客户端URL',
        'scope' => '授权范围',
        'authorization_url' => '授权URL',
        'authorization_content_type' => '授权内容类型',
        'authorization_method' => '授权请求方法',
        'issuer_url' => '发行方URL',
        'resource_metadata_url' => '资源元数据URL',
        'authorization_server_url' => '授权服务器URL',
        'authorization_endpoint' => '授权端点',
        'token_endpoint' => '令牌端点',
        'registration_endpoint' => '客户端注册端点',
        'registration_mode' => '客户端注册模式',
        'client_metadata_url' => '客户端元数据URL',
        'token_endpoint_auth_method' => '令牌端点认证方式',
        'application_type' => '应用类型',
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
        'mcp_authorization' => 'MCP标准授权',
    ],

    // 错误消息
    'validate_failed' => '验证失败',
    'not_found' => '数据不存在',
    'field_too_long' => ':label长度不能超过 :max 个字符',

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

    'authorization' => [
        'discovery_failed' => 'MCP授权服务器发现失败',
        'issuer_mismatch' => 'MCP授权服务器Issuer校验失败',
        'state_invalid' => 'MCP授权状态无效或已过期',
        'token_exchange_failed' => 'MCP授权Token交换失败',
        'not_configured' => 'MCP标准授权未配置',
    ],

    // MCP 授权能力探测
    'authorization_capability' => [
        'unsupported' => 'MCP 服务未选择 MCP 标准授权方式',
        'not_configured' => 'MCP 标准授权配置不存在',
        'resource_url_required' => 'MCP Resource 必须是完整 URL',
        'invalid_server_metadata' => '授权服务器元数据无效',
        'missing_server_endpoints' => '授权服务器元数据缺少必要端点',
        'probe_failed' => 'MCP 授权能力探测失败',
        'registration' => [
            'pre_registered' => '需要管理员预先注册客户端',
            'cimd_supported' => '授权服务器声明支持 CIMD',
            'cimd_unsupported' => '授权服务器未声明支持 CIMD',
            'dcr_found' => '发现动态客户端注册端点',
            'dcr_missing' => '未发现动态客户端注册端点',
        ],
        'warnings' => [
            'dcr_recommended' => '当前推荐动态客户端注册，首次授权可能会创建远端客户端。',
            'cimd_not_advertised' => '当前配置提供了 CIMD 地址，但授权服务器没有明确声明支持 CIMD。',
            'token_auth_not_advertised' => '授权服务器未声明 Token 端点认证方式，当前按 none 生成建议。',
        ],
        'failure_reason' => [
            'remote_request' => '远端请求失败',
            'configuration_or_discovery' => '配置校验或授权发现失败',
        ],
    ],

    // MCP 授权回调页面
    'authorization_callback' => [
        'title' => [
            'success' => '授权已完成',
            'failure' => '授权处理失败',
        ],
        'message' => [
            'success' => 'MCP 授权已完成，可以关闭此页面。',
            'failure' => 'MCP 授权回调处理失败，请返回原页面重试。',
        ],
        'description' => [
            'success' => '页面将在 10 秒后自动关闭，你也可以回到原页面继续操作。',
            'failure' => '请确认授权服务器配置正确，或重新发起授权。',
        ],
        'countdown' => ' 秒后自动关闭',
        'manual_close' => '浏览器未允许自动关闭，请手动关闭此页面。',
        'close_button' => '关闭页面',
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
