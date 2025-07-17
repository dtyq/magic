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
     * 创建沙箱.
     *
     * @param array $config 沙箱配置参数
     * @return GatewayResult 创建结果，成功时data包含sandbox_id
     */
    public function createSandbox(array $config = []): GatewayResult;

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

    public function getFileVersions(string $sandboxId, string $fileKey, string $gitDir): GatewayResult;

    public function getFileVersionContent(string $sandboxId, string $fileKey, string $commitHash, string $gitDir): GatewayResult;

    public function uploadFile(string $sandboxId, array $filePaths, string $projectId, string $organizationCode, string $taskId): GatewayResult;
}
