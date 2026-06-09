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
     * @param array<string, string> $labels Extra pod labels (e.g. ['topic-id' => '123']); merged onto gateway-managed labels, reserved keys are ignored
     * @return GatewayResult 创建结果，成功时data包含sandbox_id
     */
    public function createSandbox(string $projectId, string $sandboxId, string $workDir, string $projectSpaceRootFileId = '', string $userSpaceRootFileId = '', string $authorization = '', array $labels = []): GatewayResult;

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
     * 获取沙箱网关当前部署的最新 AGFS 镜像.
     *
     * @return string 最新 AGFS 镜像全名（如 registry.example.com/agfs:v1.2.3），失败时返回空字符串
     */
    public function getLatestAgfsImage(): string;

    /**
     * 一次性获取沙箱网关当前部署的 agent 与 agfs 最新镜像，避免两次调用。
     *
     * 任一镜像获取失败时，两个字段均返回空字符串（与单镜像接口的容错语义一致）。
     *
     * @return array{agent_image: string, agfs_image: string}
     */
    public function getLatestImages(): array;

    /**
     * 在 warm pool 中创建一个未绑定项目的沙箱。
     *
     * sandbox_id 由调用方（warm-pool worker）生成并先入库，再发请求，避免响应丢失
     * 导致的孤儿 pod。pod 名固定为 `sandbox-<sandbox_id>`，因此 sandbox_id 必须是
     * DNS-1123 label fragment（首位 [a-z0-9]，仅含小写字母/数字/-）。
     *
     * 返回 data 字段：sandbox_id / sandbox_name / agent_image / agfs_image / namespace。
     */
    public function createWarmPoolSandbox(string $sandboxId): GatewayResult;

    /**
     * 把一个 warm pool 沙箱绑定到指定项目，触发 agfs-server `/api/v1/mount`
     * 并等待 versionTree 初始首次同步完成（gateway 内部会 wait_ready=1）.
     *
     * @param string $sandboxId warm-<uuid>
     * @param string $projectId 实际项目 ID
     * @param string $projectSpaceRootFileID 项目空间 root file id（来自 task_file 表）
     * @param string $userSpaceRootFileID 用户空间 root file id（可空）
     * @param string $authorization 用户 MagicToken
     * @param array<string, string> $labels 额外 pod 标签（如 ['topic-id' => '123']）；合并到 bound-* 标签上，保留字段会被忽略
     */
    public function mountWarmPoolSandbox(
        string $sandboxId,
        string $projectId,
        string $projectSpaceRootFileID,
        string $userSpaceRootFileID,
        string $authorization,
        array $labels = []
    ): GatewayResult;
}
