<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxStruct;

/**
 * Sandbox Gateway Interface
 * Defines sandbox lifecycle management and agent forwarding functionality.
 */
interface SandboxGatewayInterface
{
    /**
     * Create sandbox.
     *
     * @param SandboxStruct $struct Sandbox configuration parameters
     * @return SandboxResult Creation result, success when data contains sandbox_id
     */
    public function create(SandboxStruct $struct): SandboxResult;

    /**
     * Get sandbox status.
     *
     * @param string $sandboxId Sandbox ID
     * @return SandboxResult Sandbox status result
     */
    public function getStatus(string $sandboxId): SandboxResult;

    /**
     * Destroy sandbox.
     *
     * @param string $sandboxId Sandbox ID
     * @return SandboxResult Destruction result
     */
    public function destroy(string $sandboxId): SandboxResult;

    /**
     * Get WebSocket URL for sandbox.
     *
     * @param string $sandboxId Sandbox ID
     * @return string WebSocket URL
     */
    public function getWebsocketUrl(string $sandboxId): string;

    /**
     * Create sandbox.
     *
     * @param array $config Sandbox configuration parameters
     * @return GatewayResult Creation result, success when data contains sandbox_id
     */
    public function createSandbox(array $config = []): GatewayResult;

    /**
     * Get single sandbox status
     *
     * @param string $sandboxId Sandbox ID
     * @return SandboxStatusResult Sandbox status result
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult;

    /**
     * Get batch sandbox status
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


    public function getFileVersionContent(string $sandboxId, string $fileKey, string $commitHash,string $gitDir): GatewayResult;
}
