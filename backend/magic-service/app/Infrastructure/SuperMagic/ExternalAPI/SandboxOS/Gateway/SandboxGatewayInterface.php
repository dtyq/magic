<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxListResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;

/**
 * Sandbox Gateway Interface.
 *
 * Defines sandbox lifecycle management and agent forwarding functionality.
 *
 * ## Per-method DataIsolation policy
 *
 * Earlier revisions of this interface carried per-request auth state
 * (user id, organization code, authorization token) on the gateway
 * service instance via `setUserContext()` + `clearUserContext()`. That
 * implementation leaked:
 *
 *   - the long-lived SandboxGatewayService singleton in DI shared
 *     state between unrelated requests (different users in different
 *     coroutines against the same instance),
 *   - any prior request's authorization token into the next request
 *     if the caller forgot to clear it.
 *
 * The interface now splits its methods into two clearly-separated
 * groups based on what they actually do:
 *
 * **Per-pod methods that talk to a specific user-bound pod** carry a
 * `DataIsolation` as their FIRST parameter. The downstream super-magic
 * agent (inside the pod) enforces User-Authorization on its agfs +
 * internal HTTP surface, so the caller must forward the user's stable
 * sandbox-token (looked up via
 * `AgentDomainService::getAuthorizationByUserId` and stamped onto the
 * DataIsolation via `setUserAuthorizationToken`). The gateway's
 * service-to-service `Sandbox-Gateway-Token` is always present
 * regardless.
 *
 *   - createSandbox        — special: stamp user identity on pod init
 *   - proxySandboxRequest  — forwards to in-pod agent
 *   - uploadFile           — uploads to in-pod agent
 *   - copyFiles            — invokes in-pod agfs
 *   - upgradeSandbox       — message to running in-pod agent
 *   - mountWarmPoolSandbox — triggers in-pod agfs /api/v1/mount
 *
 * **Control-plane methods that only hit the gateway's k8s /
 * image-registry / status cache (never the in-pod agent):** do NOT
 * take a DataIsolation. They authenticate purely via
 * `Sandbox-Gateway-Token` (the service-to-service shared secret).
 *
 *   - deleteSandbox            — k8s delete pod
 *   - getSandboxStatus         — k8s pod status
 *   - getBatchSandboxStatus    — k8s batch status
 *   - listSandboxes            — k8s pod list (运维脚本查“正在运行”的沙箱)
 *   - getLatestAgentImage      — global image version
 *   - getLatestAgfsImage       — global image version
 *   - getLatestImages          — global image version (combined)
 *   - createWarmPoolSandbox    — k8s create unbound pod
 *
 * Per-request state lives in the call signature (DataIsolation value
 * object), never on the service.
 */
interface SandboxGatewayInterface
{
    /**
     * 创建沙箱.
     *
     * @param DataIsolation $dataIsolation per-call user identity (see class doc)
     * @param string $projectId Project ID
     * @param string $sandboxId Sandbox ID
     * @param string $workDir Sandbox working directory
     * @param string $projectSpaceRootFileId Project space root directory file ID
     * @param string $userSpaceRootFileId User space root directory file ID
     * @param string $topicSpaceRootFileId Topic space root directory file ID
     * @param array<string, string> $labels 额外 pod 标签
     * @param null|SandboxImageTarget $images 目标镜像；只有指定了镜像的运行才会把镜像写进创建请求，
     *                                        未指定时留空，让网关继续使用它自己的发布版本
     */
    public function createSandbox(DataIsolation $dataIsolation, string $projectId, string $sandboxId, string $workDir, string $projectSpaceRootFileId = '', string $userSpaceRootFileId = '', string $topicSpaceRootFileId = '', array $labels = [], ?SandboxImageTarget $images = null): GatewayResult;

    /**
     * 删除（停止）沙箱.
     *
     * 纯 gateway 控制面调用（k8s API），无需 user 身份。
     */
    public function deleteSandbox(string $sandboxId): GatewayResult;

    /**
     * Get single sandbox status.
     *
     * 纯 gateway 控制面调用（k8s pod 状态），无需 user 身份。
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult;

    /**
     * Get batch sandbox status.
     *
     * 纯 gateway 控制面调用（k8s 批量状态），无需 user 身份。
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult;

    /**
     * List sandbox pods in the gateway namespace, optionally filtered by status.
     *
     * 纯 gateway 控制面调用（k8s pod 列表），无需 user 身份。运维脚本据此拿到
     * “当前真正在运行”的沙箱集合，避免从业务表反推、把已退出的沙箱重新拉起。
     *
     * @param string[] $statuses 只返回这些状态（如 ['Running']）；空数组表示不过滤
     */
    public function listSandboxes(array $statuses = []): SandboxListResult;

    /**
     * Proxy request to sandbox.
     *
     * @param DataIsolation $dataIsolation per-call user identity
     * @param string $sandboxId Sandbox ID
     * @param string $method HTTP method
     * @param string $path Target path
     * @param array $data Request data
     * @param array $headers Additional headers
     */
    public function proxySandboxRequest(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $method,
        string $path,
        array $data = [],
        array $headers = []
    ): GatewayResult;

    public function uploadFile(DataIsolation $dataIsolation, string $sandboxId, array $filePaths, string $projectId, string $organizationCode, string $taskId): GatewayResult;

    /**
     * 复制文件（同步操作）.
     *
     * `files` is serialized directly to JSON and must therefore be a
     * zero-indexed list, even when copying only one file. Passing a single
     * associative FileCopyItem would serialize as a JSON object and be
     * rejected by the Sandbox Gateway's `[]FileCopyItem` request contract.
     *
     * @param array<int, array{source_oss_path: string, target_oss_path: string}> $files
     */
    public function copyFiles(DataIsolation $dataIsolation, array $files): GatewayResult;

    /**
     * 升级沙箱镜像.
     *
     * @param string $messageId 消息ID
     * @param string $contextType 上下文类型，通常为"continue"
     */
    public function upgradeSandbox(DataIsolation $dataIsolation, string $messageId, string $contextType = 'continue'): GatewayResult;

    /**
     * 获取沙箱网关当前部署的最新 Agent 镜像.
     *
     * 纯 gateway 控制面调用（全局镜像版本），无需 user 身份。
     */
    public function getLatestAgentImage(): string;

    /**
     * 获取沙箱网关当前部署的最新 AGFS 镜像.
     *
     * 纯 gateway 控制面调用（全局镜像版本），无需 user 身份。
     */
    public function getLatestAgfsImage(): string;

    /**
     * 一次性获取沙箱网关当前部署的 agent 与 agfs 最新镜像，避免两次调用。
     *
     * 纯 gateway 控制面调用（全局镜像版本），无需 user 身份。
     *
     * @return array{agent_image: string, agfs_image: string}
     */
    public function getLatestImages(): array;

    /**
     * 在 warm pool 中创建一个未绑定项目的沙箱。
     *
     * 纯 gateway 控制面调用（k8s 创建未绑定 pod），无需 user 身份。
     */
    public function createWarmPoolSandbox(string $sandboxId): GatewayResult;

    /**
     * 把一个 warm pool 沙箱绑定到指定项目，触发 agfs-server `/api/v1/mount`
     * 并等待 versionTree 初始首次同步完成（gateway 内部会 wait_ready=1）.
     *
     * @param DataIsolation $dataIsolation per-call user identity
     * @param string $sandboxId warm-<uuid>
     * @param string $projectId 实际项目 ID
     * @param string $projectSpaceRootFileID 项目空间 root file id（来自 task_file 表）
     * @param string $userSpaceRootFileID 用户空间 root file id（可空）
     * @param string $topicSpaceRootFileID 话题空间 root file id（可空）
     * @param array<string, string> $labels 额外 pod 标签
     */
    public function mountWarmPoolSandbox(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $projectId,
        string $projectSpaceRootFileID,
        string $userSpaceRootFileID,
        string $topicSpaceRootFileID = '',
        array $labels = []
    ): GatewayResult;

    /**
     * 挂载引用项目；读写权限由文件服务校验。
     */
    public function mountReferencedProject(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $projectId,
        string $projectSpaceRootFileId
    ): GatewayResult;

    /**
     * 获取沙箱当前全部引用项目，包括尚未实际加载的挂载。
     */
    public function listReferencedProjects(DataIsolation $dataIsolation, string $sandboxId): GatewayResult;

    public function unmountReferencedProject(DataIsolation $dataIsolation, string $sandboxId, string $projectId): GatewayResult;
}
