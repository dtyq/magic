<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum MCPErrorCode: int
{
    #[ErrorMessage(message: 'mcp.validate_failed')]
    case ValidateFailed = 51500; // 验证失败

    #[ErrorMessage(message: 'mcp.not_found')]
    case NotFound = 51501; // 数据不存在

    // MCP服务相关错误码
    #[ErrorMessage(message: 'mcp.service.already_exists')]
    case ServiceAlreadyExists = 51510; // MCP服务已存在

    #[ErrorMessage(message: 'mcp.service.not_enabled')]
    case ServiceNotEnabled = 51511; // MCP服务未启用

    // 工具关联相关错误码
    #[ErrorMessage(message: 'mcp.rel.not_found')]
    case RelNotFound = 51520; // 关联资源不存在

    #[ErrorMessage(message: 'mcp.rel_version.not_found')]
    case RelVersionNotFound = 51521; // 关联资源版本不存在

    #[ErrorMessage(message: 'mcp.rel.not_enabled')]
    case RelNotEnabled = 51522; // 关联资源未启用

    #[ErrorMessage(message: 'mcp.tool.execute_failed')]
    case ToolExecuteFailed = 51523; // 工具执行失败

    // OAuth2认证相关错误码
    #[ErrorMessage(message: 'mcp.oauth2.authorization_url_generation_failed')]
    case OAuth2AuthorizationUrlGenerationFailed = 51530; // OAuth2授权URL生成失败

    #[ErrorMessage(message: 'mcp.oauth2.callback_handling_failed')]
    case OAuth2CallbackHandlingFailed = 51531; // OAuth2回调处理失败

    #[ErrorMessage(message: 'mcp.oauth2.token_refresh_failed')]
    case OAuth2TokenRefreshFailed = 51532; // OAuth2令牌刷新失败

    #[ErrorMessage(message: 'mcp.oauth2.invalid_response')]
    case OAuth2InvalidResponse = 51533; // OAuth2提供商响应无效

    #[ErrorMessage(message: 'mcp.oauth2.provider_error')]
    case OAuth2ProviderError = 51534; // OAuth2提供商返回错误

    #[ErrorMessage(message: 'mcp.oauth2.missing_access_token')]
    case OAuth2MissingAccessToken = 51535; // OAuth2响应中缺少访问令牌

    // OAuth2绑定验证相关错误码
    #[ErrorMessage(message: 'mcp.oauth2.binding.code_empty')]
    case OAuth2BindingCodeEmpty = 51540; // OAuth2绑定授权码为空

    #[ErrorMessage(message: 'mcp.oauth2.binding.state_empty')]
    case OAuth2BindingStateEmpty = 51541; // OAuth2绑定状态参数为空

    #[ErrorMessage(message: 'mcp.oauth2.binding.mcp_server_code_empty')]
    case OAuth2BindingMcpServerCodeEmpty = 51542; // OAuth2绑定MCP服务代码为空

    // 必填字段验证相关错误码
    #[ErrorMessage(message: 'mcp.required_fields.missing')]
    case RequiredFieldsMissing = 51550; // 必填字段缺失

    #[ErrorMessage(message: 'mcp.required_fields.empty')]
    case RequiredFieldsEmpty = 51551; // 必填字段为空

    // STDIO执行器相关错误码
    #[ErrorMessage(message: 'mcp.executor.stdio.connection_failed')]
    case ExecutorStdioConnectionFailed = 51560; // STDIO执行器连接失败

    #[ErrorMessage(message: 'mcp.executor.stdio.access_denied')]
    case ExecutorStdioAccessDenied = 51561; // STDIO执行器访问被拒绝

    // HTTP执行器相关错误码
    #[ErrorMessage(message: 'mcp.executor.http.connection_failed')]
    case ExecutorHttpConnectionFailed = 51562; // HTTP执行器连接失败
}
