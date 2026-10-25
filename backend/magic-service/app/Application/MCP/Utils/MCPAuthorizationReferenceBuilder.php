<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils;

use App\Domain\MCP\Constant\ServiceConfigAuthType;

/**
 * MCP Authorization 运行时引用配置构建器。
 *
 * 该构建器只保留解析运行时凭据所需的非敏感引用，避免项目配置和 mention
 * 配置分别维护安全清理规则。
 */
final class MCPAuthorizationReferenceBuilder
{
    /**
     * 将通用 MCP 配置转换为 MCP Authorization 凭据引用配置。
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function build(array $config, string $mcpServerCode): array
    {
        $headers = is_array($config['headers'] ?? null) ? $config['headers'] : [];
        foreach (array_keys($headers) as $headerName) {
            if (is_string($headerName) && strtolower($headerName) === 'authorization') {
                unset($headers[$headerName]);
            }
        }

        $config['headers'] = $headers;
        unset($config['token']);
        $config['auth_type'] = ServiceConfigAuthType::MCP_AUTHORIZATION->value;
        $config['mcp_server_code'] = $mcpServerCode;

        return $config;
    }
}
