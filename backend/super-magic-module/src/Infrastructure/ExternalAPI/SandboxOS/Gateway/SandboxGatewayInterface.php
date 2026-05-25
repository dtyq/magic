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
     * @param string $projectSpaceRootFileId Project space root directory file ID
     * @param string $userSpaceRootFileId User space root directory file ID
     * @param string $authorization User authorization token, empty string means not provided
     * @return GatewayResult 创建结果，成功时data包含sandbox_id
     */
    public function createSandbox(string $projectId, string $sandboxId, string $workDir, string $projectSpaceRootFileId = '', string $userSpaceRootFileId = '', string $authorization = ''): GatewayResult;

    /**
     * 删除（停止）沙箱.
     *
     * @param string $sandboxId Sandbox ID
     * @return GatewayResult 删除结果
     */
    public function deleteSandbox(string $sandboxId): GatewayResult;

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

    /**
     * 获取沙箱网关当前部署的最新 Agent 镜像.
     *
     * @return string 最新 Agent 镜像全名（如 registry.example.com/agent:v1.2.3），失败时返回空字符串
     */
    public function getLatestAgentImage(): string;

    /**
     * 在 warm pool 中创建一个未绑定项目的沙箱.
     * data 字段包含: sandbox_id (warm-<uuid>) / sandbox_name / agent_image / status.
     */
    public function createWarmPoolSandbox(): GatewayResult;

    /**
     * 把一个 warm pool 沙箱绑定到指定项目，触发 agfs-server `/api/v1/mount`
     * 并等待 versionTree 初始首次同步完成（gateway 内部会 wait_ready=1）.
     *
     * @param string $sandboxId warm-<uuid>
     * @param string $projectId 实际项目 ID
     * @param string $projectSpaceRootFileID 项目空间 root file id（来自 task_file 表）
     * @param string $userSpaceRootFileID 用户空间 root file id（可空）
     * @param string $authorization 用户 MagicToken
     */
    public function mountWarmPoolSandbox(
        string $sandboxId,
        string $projectId,
        string $projectSpaceRootFileID,
        string $userSpaceRootFileID,
        string $authorization
    ): GatewayResult;
}
