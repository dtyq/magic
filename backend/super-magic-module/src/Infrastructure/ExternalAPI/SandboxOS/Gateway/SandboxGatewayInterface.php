<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;

/**
 * Sandbox Gateway Interface
 * Defines sandbox lifecycle management and agent forwarding functionality.
 */
interface SandboxGatewayInterface
{
    /**
     * Set user context for the current request.
     * This method should be called before making any requests that require user information.
     *
     * @param null|string $userId User ID
     * @param null|string $organizationCode Organization code
     * @return self Returns self for method chaining
     */
    public function setUserContext(?string $userId, ?string $organizationCode): self;

    /**
     * Clear user context.
     *
     * @return self Returns self for method chaining
     */
    public function clearUserContext(): self;

    /**
     * 创建沙箱.
     *
     * @param string $projectId Project ID
     * @param string $sandboxId Sandbox ID
     * @param string $workDir Sandbox working directory
     * @return GatewayResult 创建结果，成功时data包含sandbox_id
     */
    public function createSandbox(string $projectId, string $sandboxId, string $workDir): GatewayResult;

    /**
     * Get single sandbox status.
     *
     * @param string $sandboxId Sandbox ID
     * @return SandboxStatusResult Sandbox status result
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult;

    /**
     * Get batch sandbox status.
     *
     * @param array $sandboxIds Sandbox ID list
     * @return BatchStatusResult Batch status result
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult;

    /**
     * Proxy request to sandbox.
     *
     * @param string $sandboxId Sandbox ID
     * @param string $method HTTP method
     * @param string $path Target path
     * @param array $data Request data
     * @param array $headers Additional headers
     * @return GatewayResult Proxy result
     */
    public function proxySandboxRequest(
        string $sandboxId,
        string $method,
        string $path,
        array $data = [],
        array $headers = []
    ): GatewayResult;

    /**
     * 确保沙箱存在并且可用.
     *
     * @param string $sandboxId Sandbox ID
     * @param string $projectId Project ID
     * @param string $workDir Working directory
     * @return string 实际使用的沙箱ID
     */
    public function ensureSandboxAvailable(string $sandboxId, string $projectId, string $workDir): string;

    public function uploadFile(string $sandboxId, array $filePaths, string $projectId, string $organizationCode, string $taskId): GatewayResult;

    /**
     * 复制文件（同步操作）.
     *
     * @param array $files 文件复制项目数组，格式：[['source_oss_path' => 'xxx', 'target_oss_path' => 'xxx'], ...]
     * @return GatewayResult 复制结果
     */
    public function copyFiles(array $files): GatewayResult;

    /**
     * 升级沙箱镜像.
     *
     * @param string $messageId 消息ID
     * @param string $contextType 上下文类型，通常为"continue"
     * @return GatewayResult 升级结果
     */
    public function upgradeSandbox(string $messageId, string $contextType = 'continue'): GatewayResult;
}
