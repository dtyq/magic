<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Exception;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Logger\LoggerFactory;

/**
 * 沙箱网关服务实现
 * 提供沙箱生命周期管理和代理转发功能.
 */
class SandboxGatewayService extends AbstractSandboxOS implements SandboxGatewayInterface
{
    public function __construct(LoggerFactory $loggerFactory)
    {
        parent::__construct($loggerFactory);
    }

    /**
     * 创建沙箱.
     */
    public function createSandbox(array $config = []): GatewayResult
    {
        $this->logger->info('[Sandbox][Gateway] Creating sandbox', ['config' => $config]);

        try {
            $response = $this->client->post($this->buildApiPath('api/v1/sandboxes'), [
                'headers' => $this->getAuthHeaders(),
                'json' => $config,
                'timeout' => 30,
            ]);

            $responseData = json_decode($response->getBody()->getContents(), true);
            $result = GatewayResult::fromApiResponse($responseData);

            if ($result->isSuccess()) {
                $sandboxId = $result->getDataValue('sandbox_id');
                $this->logger->info('[Sandbox][Gateway] Sandbox created successfully', [
                    'sandbox_id' => $sandboxId,
                ]);
            } else {
                $this->logger->error('[Sandbox][Gateway] Failed to create sandbox', [
                    'code' => $result->getCode(),
                    'message' => $result->getMessage(),
                ]);
            }

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('[Sandbox][Gateway] HTTP error when creating sandbox', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            return GatewayResult::error('HTTP request failed: ' . $e->getMessage());
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Gateway] Unexpected error when creating sandbox', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return GatewayResult::error('Unexpected error: ' . $e->getMessage());
        }
    }

    /**
     * 获取单个沙箱状态
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        $this->logger->info('[Sandbox][Gateway] Getting sandbox status', ['sandbox_id' => $sandboxId]);

        try {
            $response = $this->client->get($this->buildApiPath("api/v1/sandboxes/{$sandboxId}"), [
                'headers' => $this->getAuthHeaders(),
                'timeout' => 10,
            ]);

            $responseData = json_decode($response->getBody()->getContents(), true);
            $result = SandboxStatusResult::fromApiResponse($responseData);

            $this->logger->info('[Sandbox][Gateway] Sandbox status retrieved', [
                'sandbox_id' => $sandboxId,
                'status' => $result->getStatus(),
                'success' => $result->isSuccess(),
            ]);

            if ($result->getCode() === ResponseCode::NOT_FOUND) {
                $result->setStatus(SandboxStatus::NOT_FOUND);
                $result->setSandboxId($sandboxId);
            }

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('[Sandbox][Gateway] HTTP error when getting sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            return SandboxStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'HTTP request failed: ' . $e->getMessage(),
                'data' => ['sandbox_id' => $sandboxId],
            ]);
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Gateway] Unexpected error when getting sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            return SandboxStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => ['sandbox_id' => $sandboxId],
            ]);
        }
    }

    /**
     * 批量获取沙箱状态
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult
    {
        $this->logger->debug('[Sandbox][Gateway] Getting batch sandbox status', [
            'sandbox_ids' => $sandboxIds,
            'count' => count($sandboxIds),
        ]);

        if (empty($sandboxIds)) {
            return BatchStatusResult::fromApiResponse([
                'code' => 1000,
                'message' => 'Success',
                'data' => [],
            ]);
        }

        try {
            $response = $this->client->post($this->buildApiPath('api/v1/sandboxes/queries'), [
                'headers' => $this->getAuthHeaders(),
                'json' => ['sandbox_ids' => $sandboxIds],
                'timeout' => 15,
            ]);

            $responseData = json_decode($response->getBody()->getContents(), true);
            $result = BatchStatusResult::fromApiResponse($responseData);

            $this->logger->debug('[Sandbox][Gateway] Batch sandbox status retrieved', [
                'requested_count' => count($sandboxIds),
                'returned_count' => $result->getTotalCount(),
                'running_count' => $result->getRunningCount(),
                'success' => $result->isSuccess(),
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('[Sandbox][Gateway] HTTP error when getting batch sandbox status', [
                'sandbox_ids' => $sandboxIds,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            return BatchStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'HTTP request failed: ' . $e->getMessage(),
                'data' => [],
            ]);
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Gateway] Unexpected error when getting batch sandbox status', [
                'sandbox_ids' => $sandboxIds,
                'error' => $e->getMessage(),
            ]);
            return BatchStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    /**
     * 代理转发请求到沙箱.
     */
    public function proxySandboxRequest(
        string $sandboxId,
        string $method,
        string $path,
        array $data = [],
        array $headers = []
    ): GatewayResult {
        $this->logger->debug('[Sandbox][Gateway] Proxying request to sandbox', [
            'sandbox_id' => $sandboxId,
            'method' => $method,
            'path' => $path,
            'has_data' => ! empty($data),
        ]);

        try {
            $requestOptions = [
                'headers' => array_merge($this->getAuthHeaders(), $headers),
                'timeout' => 30,
            ];

            // Add request body based on method
            if (in_array(strtoupper($method), ['POST', 'PUT', 'PATCH']) && ! empty($data)) {
                $requestOptions['json'] = $data;
            }

            $proxyPath = $this->buildProxyPath($sandboxId, $path);
            $response = $this->client->request($method, $this->buildApiPath($proxyPath), $requestOptions);

            $body = $response->getBody()->getContents();
            if (empty($body)) {
                $this->logger->warning('[Sandbox][Gateway] Received empty response body from sandbox', [
                    'sandbox_id' => $sandboxId,
                    'method' => $method,
                    'path' => $path,
                ]);
                return GatewayResult::error('Received empty response from sandbox');
            }

            if (! json_validate($body)) {
                $this->logger->warning('[Sandbox][Gateway] Invalid JSON response from sandbox', [
                    'sandbox_id' => $sandboxId,
                    'method' => $method,
                    'path' => $path,
                    'raw_body' => $body,
                ]);
                return GatewayResult::error('Invalid JSON response from sandbox');
            }

            $responseData = json_decode($body, true);

            $result = GatewayResult::fromApiResponse($responseData);

            $this->logger->debug('[Sandbox][Gateway] Proxy request completed', [
                'sandbox_id' => $sandboxId,
                'method' => $method,
                'path' => $path,
                'success' => $result->isSuccess(),
                'response_code' => $result->getCode(),
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('[Sandbox][Gateway] HTTP error when proxying request', [
                'sandbox_id' => $sandboxId,
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            return GatewayResult::error('HTTP request failed: ' . $e->getMessage());
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Gateway] Unexpected error when proxying request', [
                'sandbox_id' => $sandboxId,
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            return GatewayResult::error('Unexpected error: ' . $e->getMessage());
        }
    }

    public function getFileVersions(string $sandboxId, string $fileKey, string $gitDir = '.workspace'): GatewayResult
    {
        $this->logger->info('[Sandbox][Gateway] getFileVersions', ['sandbox_id' => $sandboxId, 'file_key' => $fileKey]);

        return $this->proxySandboxRequest($sandboxId, 'POST', 'api/v1/file/versions', ['file_key' => $fileKey, 'git_directory' => $gitDir]);
    }

    public function getFileVersionContent(string $sandboxId, string $fileKey, string $commitHash, string $gitDir): GatewayResult
    {
        $this->logger->info('[Sandbox][Gateway] getFileVersionContent', ['sandbox_id' => $sandboxId, 'file_key' => $fileKey, 'commit_hash' => $commitHash, 'git_directory' => $gitDir]);

        return $this->proxySandboxRequest($sandboxId, 'POST', 'api/v1/file/content', ['file_key' => $fileKey, 'commit_hash' => $commitHash, 'git_directory' => $gitDir]);
    }

    /**
     * 确保沙箱可用并代理请求.
     */
    public function ensureSandboxAndProxy(
        string $sandboxId,
        string $method,
        string $path,
        array $data = [],
        array $headers = []
    ): GatewayResult {
        try {
            // 1. 确保沙箱存在并且可用
            $actualSandboxId = $this->ensureSandboxAvailable($sandboxId);
            if (empty($actualSandboxId)) {
                return GatewayResult::error('Failed to create or access sandbox');
            }

            // 2. 代理请求到沙箱
            $result = $this->proxySandboxRequest($actualSandboxId, $method, $path, $data, $headers);

            // 3. 在结果中包含实际使用的沙箱ID
            if ($result->isSuccess()) {
                $resultData = $result->getData();
                $resultData['actual_sandbox_id'] = $actualSandboxId;
                $result = GatewayResult::success($resultData, $result->getMessage());
            }

            return $result;

        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Gateway] Error in ensureSandboxAndProxy', [
                'sandbox_id' => $sandboxId,
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            return GatewayResult::error('Unexpected error: ' . $e->getMessage());
        }
    }

    /**
     * 确保沙箱存在并且可用
     */
    private function ensureSandboxAvailable(string $sandboxId): string
    {
        try {
            // 如果沙箱ID不为空，先检查沙箱状态
            if (! empty($sandboxId)) {
                $statusResult = $this->getSandboxStatus($sandboxId);

                // 如果沙箱存在且状态为运行中，直接返回
                if ($statusResult->isSuccess() &&
                    $statusResult->getCode() === ResponseCode::SUCCESS &&
                    SandboxStatus::isAvailable($statusResult->getStatus())) {
                    $this->logger->debug('[Sandbox][Gateway] Sandbox is available, using existing sandbox', [
                        'sandbox_id' => $sandboxId,
                    ]);
                    return $sandboxId;
                }

                // 记录需要创建新沙箱的原因
                if ($statusResult->getCode() === ResponseCode::NOT_FOUND) {
                    $this->logger->info('[Sandbox][Gateway] Sandbox not found, creating new sandbox', [
                        'sandbox_id' => $sandboxId,
                    ]);
                } else {
                    $this->logger->info('[Sandbox][Gateway] Sandbox status is not available, creating new sandbox', [
                        'sandbox_id' => $sandboxId,
                        'current_status' => $statusResult->getStatus(),
                    ]);
                }
            } else {
                $this->logger->info('[Sandbox][Gateway] Sandbox ID is empty, creating new sandbox');
            }

            $createResult = $this->createSandbox(['sandbox_id' => $sandboxId]);

            if (! $createResult->isSuccess()) {
                $this->logger->error('[Sandbox][Gateway] Failed to create sandbox', [
                    'requested_sandbox_id' => $sandboxId,
                    'code' => $createResult->getCode(),
                    'message' => $createResult->getMessage(),
                ]);
                return '';
            }

            $newSandboxId = $createResult->getDataValue('sandbox_id');

            // 轮询等待沙箱进入 Running 状态
            $maxRetries = 15; // 最多等待约30秒
            $retryDelay = 2; // 每次间隔2秒

            for ($i = 0; $i < $maxRetries; ++$i) {
                $statusResult = $this->getSandboxStatus($newSandboxId);
                if ($statusResult->isSuccess() && SandboxStatus::isAvailable($statusResult->getStatus())) {
                    $this->logger->info('[Sandbox][Gateway] Sandbox is now running', [
                        'sandbox_id' => $newSandboxId,
                        'attempts' => $i + 1,
                    ]);
                    return $newSandboxId;
                }
                $this->logger->info('[Sandbox][Gateway] Waiting for sandbox to become ready...', [
                    'sandbox_id' => $newSandboxId,
                    'current_status' => $statusResult->getStatus(),
                    'attempt' => $i + 1,
                ]);
                sleep($retryDelay);
            }

            $this->logger->error('[Sandbox][Gateway] Timeout waiting for sandbox to become running', [
                'sandbox_id' => $newSandboxId,
            ]);

            return ''; // 超时后返回空
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Gateway] Error ensuring sandbox availability', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }
}
