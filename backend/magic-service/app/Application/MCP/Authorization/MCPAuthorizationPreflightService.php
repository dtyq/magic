<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Throwable;

/**
 * MCP 2026-07-28 Authorization 新增服务轻量预检服务。
 *
 * 预检只确认 MCP 地址可访问，以及授权发现信息和客户端配置基本完整；不执行用户授权、DCR、Token 交换或工具调用。
 */
class MCPAuthorizationPreflightService
{
    public function __construct(
        private readonly MCPAuthorizationCapabilityService $capabilityService
    ) {
    }

    /**
     * 检查 MCP Server 是否具备进入 Authorization 流程的基础条件。
     *
     * @throws Throwable
     */
    public function check(MCPServerEntity $mcpServer): void
    {
        try {
            // 保存阶段仍执行严格配置校验，避免能力探测的宽松字段分析绕过必填约束。
            $mcpServer->getServiceConfig()->validate();
        } catch (Throwable $throwable) {
            ExceptionBuilder::throw(
                MCPErrorCode::MCPAuthorizationDiscoveryFailed,
                $throwable->getMessage(),
                throwable: $throwable
            );
        }

        $result = $this->capabilityService->analyze($mcpServer);
        if (($result['status'] ?? '') === 'unsupported') {
            return;
        }
        if (($result['status'] ?? '') === 'invalid' && ($result['error_code'] ?? '') === 'MCPAuthorizationNotConfigured') {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationNotConfigured);
        }
        if (($result['status'] ?? '') !== 'ready') {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationDiscoveryFailed);
        }
    }
}
