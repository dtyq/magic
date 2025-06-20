<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\AbstractSandbox;

/**
 * SandboxOS 基础抽象类
 * 提供 SandboxOS 网关和 Agent 模块的共享基础设施
 */
abstract class AbstractSandboxOS extends AbstractSandbox
{
    public function __construct(\Hyperf\Logger\LoggerFactory $loggerFactory)
    {
        parent::__construct($loggerFactory);
    }
    /**
     * 获取认证头信息
     * 根据沙箱通信文档使用 X-Sandbox-Gateway 头
     */
    protected function getAuthHeaders(): array
    {
        return [
            'X-Sandbox-Gateway' => $this->token,
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * 构建完整的API路径
     */
    protected function buildApiPath(string $path): string
    {
        return ltrim($path, '/');
    }

    /**
     * 构建沙箱转发路径
     */
    protected function buildProxyPath(string $sandboxId, string $agentPath): string
    {
        return sprintf('api/v1/sandboxes/%s/proxy/%s', $sandboxId, ltrim($agentPath, '/'));
    }
} 