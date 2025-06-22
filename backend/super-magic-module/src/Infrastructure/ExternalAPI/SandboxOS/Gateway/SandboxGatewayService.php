<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
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
        $this->logger->debug('[Sandbox][Gateway] Getting sandbox status', ['sandbox_id' => $sandboxId]);

        try {
            $response = $this->client->get($this->buildApiPath("api/v1/sandboxes/{$sandboxId}"), [
                'headers' => $this->getAuthHeaders(),
                'timeout' => 10,
            ]);

            $responseData = json_decode($response->getBody()->getContents(), true);
            $result = SandboxStatusResult::fromApiResponse($responseData);

            $this->logger->debug('[Sandbox][Gateway] Sandbox status retrieved', [
                'sandbox_id' => $sandboxId,
                'status' => $result->getStatus(),
                'success' => $result->isSuccess(),
            ]);

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
            // 根据沙箱通信文档，批量查询使用GET请求但需要JSON请求体
            $response = $this->client->request('GET', $this->buildApiPath('api/v1/sandboxes/queries'), [
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

            $responseData = json_decode($response->getBody()->getContents(), true);
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
}
