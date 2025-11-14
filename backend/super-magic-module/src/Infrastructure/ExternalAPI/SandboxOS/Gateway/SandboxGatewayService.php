<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway;

use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Exception;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Exception\ServerException;
use Hyperf\Logger\LoggerFactory;
use Throwable;

use function Hyperf\Support\retry;

/**
 * 沙箱网关服务实现
 * 提供沙箱生命周期管理和代理转发功能.
 */
class SandboxGatewayService extends AbstractSandboxOS implements SandboxGatewayInterface
{
    private ?string $userId = null;

    private ?string $organizationCode = null;

    public function __construct(LoggerFactory $loggerFactory)
    {
        parent::__construct($loggerFactory);
    }

    /**
     * Set user context for the current request.
     * This method should be called before making any requests that require user information.
     */
    public function setUserContext(?string $userId, ?string $organizationCode): self
    {
        $this->userId = $userId;
        $this->organizationCode = $organizationCode;
        return $this;
    }

    /**
     * Clear user context.
     */
    public function clearUserContext(): self
    {
        $this->userId = null;
        $this->organizationCode = null;
        return $this;
    }

    /**
     * 创建沙箱.
     */
    public function createSandbox(string $projectId, string $sandboxId, string $workDir): GatewayResult
    {
        $config = ['project_id' => $projectId, 'sandbox_id' => $sandboxId, 'project_oss_path' => $workDir];

        $this->logger->info('[Sandbox][Gateway] Creating sandbox', [
            'config' => $config,
            'max_retries' => 5,
            'retry_delay' => 30000,
        ]);

        try {
            return retry(5, function () use ($config, $sandboxId) {
                try {
                    $response = $this->getClient()->post($this->buildApiPath('api/v1/sandboxes'), [
                        'headers' => $this->getAuthHeaders(),
                        'json' => $config,
                        'timeout' => 30,
                    ]);

                    $responseData = json_decode($response->getBody()->getContents(), true);

                    // 添加调试日志，打印原始API响应数据
                    $this->logger->info('[Sandbox][Gateway] Raw API response data', [
                        'response_data' => $responseData,
                        'json_last_error' => json_last_error(),
                        'json_last_error_msg' => json_last_error_msg(),
                    ]);

                    $result = GatewayResult::fromApiResponse($responseData ?? []);

                    // 添加详细的调试日志，检查 GatewayResult 对象
                    $this->logger->info('[Sandbox][Gateway] GatewayResult object analysis', [
                        'result_class' => get_class($result),
                        'result_is_success' => $result->isSuccess(),
                        'result_code' => $result->getCode(),
                        'result_message' => $result->getMessage(),
                        'result_data_raw' => $result->getData(),
                        'result_data_type' => gettype($result->getData()),
                        'result_data_json' => json_encode($result->getData()),
                        'sandbox_id_via_getDataValue' => $result->getDataValue('sandbox_id'),
                        'sandbox_id_via_getData_direct' => $result->getData()['sandbox_id'] ?? 'KEY_NOT_FOUND',
                    ]);

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
                    $isRetryableError = $this->isRetryableError($e);

                    $this->logger->error('[Sandbox][Gateway] HTTP error when creating sandbox', [
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'is_retryable' => $isRetryableError,
                    ]);

                    // Only retry for retryable errors
                    if (! $isRetryableError) {
                        return GatewayResult::error('HTTP request failed: ' . $e->getMessage());
                    }

                    // Re-throw for retry mechanism to handle
                    throw $e;
                } catch (Exception $e) {
                    $this->logger->error('[Sandbox][Gateway] Unexpected error when creating sandbox', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    return GatewayResult::error('Unexpected error: ' . $e->getMessage());
                }
            }, 30000); // 30 seconds delay between retries
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Gateway] All retry attempts failed for creating sandbox', [
                'config' => $config,
                'error' => $e->getMessage(),
            ]);
            return GatewayResult::error('HTTP request failed after retries: ' . $e->getMessage());
        }
    }

    /**
     * 获取单个沙箱状态
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        $this->logger->info('[Sandbox][Gateway] Getting sandbox status', [
            'sandbox_id' => $sandboxId,
            'max_retries' => 3,
        ]);

        try {
            return retry(3, function () use ($sandboxId) {
                try {
                    $response = $this->getClient()->get($this->buildApiPath("api/v1/sandboxes/{$sandboxId}"), [
                        'headers' => $this->getAuthHeaders(),
                        'timeout' => 10,
                    ]);

                    $responseData = json_decode($response->getBody()->getContents(), true);

                    if (empty($responseData)) {
                        throw new Exception('Sandbox status response is empty');
                    }

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
                    $isRetryableError = $this->isRetryableError($e);

                    $this->logger->error('[Sandbox][Gateway] HTTP error when getting sandbox status', [
                        'sandbox_id' => $sandboxId,
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'is_retryable' => $isRetryableError,
                    ]);

                    // Only retry for retryable errors
                    if (! $isRetryableError) {
                        return SandboxStatusResult::fromApiResponse([
                            'code' => 2000,
                            'message' => 'HTTP request failed: ' . $e->getMessage(),
                            'data' => ['sandbox_id' => $sandboxId],
                        ]);
                    }

                    // Re-throw for retry mechanism to handle
                    throw $e;
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
            }, 1000); // Start with 1 second delay
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Gateway] All retry attempts failed for getting sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            return SandboxStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'HTTP request failed after retries: ' . $e->getMessage(),
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
            'max_retries' => 3,
        ]);

        if (empty($sandboxIds)) {
            return BatchStatusResult::fromApiResponse([
                'code' => 1000,
                'message' => 'Success',
                'data' => [],
            ]);
        }

        // Filter out empty or null sandbox IDs
        $filteredSandboxIds = array_filter($sandboxIds, function ($id) {
            return ! empty(trim($id));
        });

        if (empty($filteredSandboxIds)) {
            $this->logger->warning('[Sandbox][Gateway] All sandbox IDs are empty after filtering', [
                'original_ids' => $sandboxIds,
            ]);
            return BatchStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'All sandbox IDs are empty',
                'data' => [],
            ]);
        }

        try {
            return retry(3, function () use ($filteredSandboxIds) {
                try {
                    $response = $this->getClient()->post($this->buildApiPath('api/v1/sandboxes/queries'), [
                        'headers' => $this->getAuthHeaders(),
                        'json' => ['sandbox_ids' => array_values($filteredSandboxIds)], // Ensure indexed array
                        'timeout' => 15,
                    ]);

                    $responseData = json_decode($response->getBody()->getContents(), true);

                    if (empty($responseData)) {
                        throw new Exception('Batch sandbox status response is empty');
                    }
                    $result = BatchStatusResult::fromApiResponse($responseData);

                    $this->logger->debug('[Sandbox][Gateway] Batch sandbox status retrieved', [
                        'requested_count' => count($filteredSandboxIds),
                        'returned_count' => $result->getTotalCount(),
                        'running_count' => $result->getRunningCount(),
                        'success' => $result->isSuccess(),
                    ]);

                    return $result;
                } catch (GuzzleException $e) {
                    $isRetryableError = $this->isRetryableError($e);

                    $this->logger->error('[Sandbox][Gateway] HTTP error when getting batch sandbox status', [
                        'sandbox_ids' => $filteredSandboxIds,
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'is_retryable' => $isRetryableError,
                    ]);

                    // Only retry for retryable errors
                    if (! $isRetryableError) {
                        return BatchStatusResult::fromApiResponse([
                            'code' => 2000,
                            'message' => 'HTTP request failed: ' . $e->getMessage(),
                            'data' => [],
                        ]);
                    }

                    // Re-throw for retry mechanism to handle
                    throw $e;
                } catch (Exception $e) {
                    $this->logger->error('[Sandbox][Gateway] Unexpected error when getting batch sandbox status', [
                        'sandbox_ids' => $filteredSandboxIds,
                        'error' => $e->getMessage(),
                    ]);
                    return BatchStatusResult::fromApiResponse([
                        'code' => 2000,
                        'message' => 'Unexpected error: ' . $e->getMessage(),
                        'data' => [],
                    ]);
                }
            }, 1000); // Start with 1 second delay
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Gateway] All retry attempts failed for batch sandbox status', [
                'sandbox_ids' => $filteredSandboxIds,
                'error' => $e->getMessage(),
            ]);
            return BatchStatusResult::fromApiResponse([
                'code' => 2000,
                'message' => 'HTTP request failed after retries: ' . $e->getMessage(),
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
            'max_retries' => 3,
        ]);

        try {
            return retry(3, function () use ($sandboxId, $method, $path, $data, $headers) {
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
                    // $proxyPath = $path;

                    $response = $this->getClient()->request($method, $this->buildApiPath($proxyPath), $requestOptions);

                    $responseData = json_decode($response->getBody()->getContents(), true);
                    if (empty($responseData)) {
                        throw new Exception('Proxy sandbox status response is empty');
                    }
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
                    $isRetryableError = $this->isRetryableError($e);

                    $this->logger->error('[Sandbox][Gateway] HTTP error when proxying request', [
                        'sandbox_id' => $sandboxId,
                        'method' => $method,
                        'path' => $path,
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'is_retryable' => $isRetryableError,
                    ]);

                    // Only retry for retryable errors
                    if (! $isRetryableError) {
                        return GatewayResult::error('HTTP request failed: ' . $e->getMessage());
                    }

                    // Re-throw for retry mechanism to handle
                    throw $e;
                } catch (Exception $e) {
                    $this->logger->error('[Sandbox][Gateway] Unexpected error when proxying request', [
                        'sandbox_id' => $sandboxId,
                        'method' => $method,
                        'path' => $path,
                        'error' => $e->getMessage(),
                    ]);
                    return GatewayResult::error('Unexpected error: ' . $e->getMessage());
                }
            }, 1000); // Start with 1 second delay
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Gateway] All retry attempts failed', [
                'sandbox_id' => $sandboxId,
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            return GatewayResult::error('HTTP request failed after retries: ' . $e->getMessage());
        }
    }

    public function uploadFile(string $sandboxId, array $filePaths, string $projectId, string $organizationCode, string $taskId): GatewayResult
    {
        $this->logger->info('[Sandbox][Gateway] uploadFile', ['sandbox_id' => $sandboxId, 'file_paths' => $filePaths, 'project_id' => $projectId, 'organization_code' => $organizationCode, 'task_id' => $taskId]);

        return $this->proxySandboxRequest($sandboxId, 'POST', 'api/file/upload', ['sandbox_id' => $sandboxId, 'file_paths' => $filePaths, 'project_id' => $projectId, 'organization_code' => $organizationCode, 'task_id' => $taskId]);
    }

    /**
     * 确保沙箱存在并且可用.
     */
    public function ensureSandboxAvailable(string $sandboxId, string $projectId, string $workDir = ''): string
    {
        try {
            // 检查沙箱是否可用
            if (! empty($sandboxId)) {
                $statusResult = $this->getSandboxStatus($sandboxId);

                // 如果沙箱存在且状态为运行中，直接返回
                if ($statusResult->isSuccess()
                    && $statusResult->getCode() === ResponseCode::SUCCESS
                    && SandboxStatus::isAvailable($statusResult->getStatus())) {
                    $this->logger->info('ensureSandboxAvailable Sandbox is available, using existing sandbox', [
                        'sandbox_id' => $sandboxId,
                    ]);
                    return $sandboxId;
                }

                // 如果沙箱状态为 Pending，等待其变为 Running
                if ($statusResult->isSuccess()
                    && $statusResult->getCode() === ResponseCode::SUCCESS
                    && $statusResult->getStatus() === SandboxStatus::PENDING) {
                    $this->logger->info('ensureSandboxAvailable Sandbox is pending, waiting for it to become running', [
                        'sandbox_id' => $sandboxId,
                    ]);

                    try {
                        // 等待现有沙箱变为 Running
                        return $this->waitForSandboxRunning($sandboxId, 'existing');
                    } catch (SandboxOperationException $e) {
                        // 如果等待失败，继续创建新沙箱
                        $this->logger->warning('ensureSandboxAvailable Failed to wait for existing sandbox, creating new sandbox', [
                            'sandbox_id' => $sandboxId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                // 记录需要创建新沙箱的原因
                if ($statusResult->getCode() === ResponseCode::NOT_FOUND) {
                    $this->logger->info('ensureSandboxAvailable Sandbox not found, creating new sandbox', [
                        'sandbox_id' => $sandboxId,
                    ]);
                } else {
                    $this->logger->info('ensureSandboxAvailable Sandbox status is not available, creating new sandbox', [
                        'sandbox_id' => $sandboxId,
                        'current_status' => $statusResult->getStatus(),
                    ]);
                }
            } else {
                $this->logger->info('ensureSandboxAvailable Sandbox ID is empty, creating new sandbox');
            }

            // 创建新沙箱
            $createResult = $this->createSandbox($projectId, $sandboxId, $workDir);

            if (! $createResult->isSuccess()) {
                $this->logger->error('ensureSandboxAvailable Failed to create sandbox', [
                    'requested_sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'code' => $createResult->getCode(),
                    'message' => $createResult->getMessage(),
                ]);
                throw new SandboxOperationException('Create sandbox', $createResult->getMessage(), $createResult->getCode());
            }

            $newSandboxId = $createResult->getDataValue('sandbox_id');

            // 添加调试日志，检查是否正确获取到了 sandbox_id
            $this->logger->info('ensureSandboxAvailable Created sandbox, starting to wait for it to become running', [
                'requested_sandbox_id' => $sandboxId,
                'new_sandbox_id' => $newSandboxId,
                'project_id' => $projectId,
                'create_result_data' => $createResult->getData(),
            ]);

            // 如果没有获取到 sandbox_id，直接返回错误
            if (empty($newSandboxId) || $newSandboxId !== $sandboxId) {
                $this->logger->error('ensureSandboxAvailable Failed to get sandbox_id from create result', [
                    'requested_sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'new_sandbox_id' => $newSandboxId,
                    'create_result_data' => $createResult->getData(),
                ]);
                throw new SandboxOperationException('Get sandbox_id from create result', 'Failed to get sandbox_id from create result', 2001);
            }

            // 等待新沙箱变为 Running
            return $this->waitForSandboxRunning($newSandboxId, 'new');
        } catch (SandboxOperationException $e) {
            // 重新抛出沙箱操作异常
            $this->logger->error('ensureSandboxAvailable Error ensuring sandbox availability', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        } catch (Exception $e) {
            $this->logger->error('ensureSandboxAvailable Error ensuring sandbox availability', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            throw new SandboxOperationException('Ensure sandbox availability', $e->getMessage(), 2000);
        }
    }

    /**
     * 复制文件（同步操作）.
     */
    public function copyFiles(array $files): GatewayResult
    {
        $requestData = [
            'files' => $files,
        ];

        $this->logger->info('[Sandbox][Gateway] Copying files', [
            'files_count' => count($requestData['files']),
            'max_retries' => 3,
        ]);

        try {
            return retry(3, function () use ($requestData) {
                try {
                    $response = $this->getClient()->post($this->buildApiPath('api/v1/files/copy'), [
                        'headers' => $this->getAuthHeaders(),
                        'json' => $requestData,
                        'timeout' => 60, // Increased timeout for file copy operations
                    ]);

                    $responseData = json_decode($response->getBody()->getContents(), true);

                    $this->logger->info('[Sandbox][Gateway] Raw API response for file copy', [
                        'response_data' => $responseData,
                        'json_last_error' => json_last_error(),
                        'json_last_error_msg' => json_last_error_msg(),
                    ]);

                    $result = GatewayResult::fromApiResponse($responseData ?? []);

                    if ($result->isSuccess()) {
                        $this->logger->info('[Sandbox][Gateway] File copy completed successfully', [
                            'files_count' => count($requestData['files']),
                        ]);
                    } else {
                        $this->logger->error('[Sandbox][Gateway] Failed to copy files', [
                            'files_count' => count($requestData['files']),
                            'code' => $result->getCode(),
                            'message' => $result->getMessage(),
                        ]);
                    }

                    return $result;
                } catch (GuzzleException $e) {
                    $isRetryableError = $this->isRetryableError($e);

                    $this->logger->error('[Sandbox][Gateway] HTTP error when copying files', [
                        'files_count' => count($requestData['files']),
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'is_retryable' => $isRetryableError,
                    ]);

                    // Only retry for retryable errors
                    if (! $isRetryableError) {
                        return GatewayResult::error('HTTP request failed: ' . $e->getMessage());
                    }

                    // Re-throw for retry mechanism to handle
                    throw $e;
                } catch (Exception $e) {
                    $this->logger->error('[Sandbox][Gateway] Unexpected error when copying files', [
                        'files_count' => count($requestData['files']),
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    return GatewayResult::error('Unexpected error: ' . $e->getMessage());
                }
            }, 1000); // Start with 1 second delay between retries
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Gateway] All retry attempts failed for copying files', [
                'files_count' => count($requestData['files']),
                'error' => $e->getMessage(),
            ]);
            return GatewayResult::error('HTTP request failed after retries: ' . $e->getMessage());
        }
    }

    /**
     * 升级沙箱镜像.
     */
    public function upgradeSandbox(string $messageId, string $contextType = 'continue'): GatewayResult
    {
        $config = [
            'message_id' => $messageId,
            'context_type' => $contextType,
        ];

        $this->logger->info('[Sandbox][Gateway] Upgrading sandbox', [
            'message_id' => $messageId,
            'context_type' => $contextType,
            'max_retries' => 3,
        ]);

        try {
            return retry(3, function () use ($config, $messageId) {
                try {
                    $response = $this->getClient()->put($this->buildApiPath('api/v1/sandboxes/upgrade'), [
                        'headers' => $this->getAuthHeaders(),
                        'json' => $config,
                        'timeout' => 60, // 升级可能需要更长时间
                    ]);

                    $responseData = json_decode($response->getBody()->getContents(), true);

                    $this->logger->info('[Sandbox][Gateway] Raw upgrade API response', [
                        'response_data' => $responseData,
                        'message_id' => $messageId,
                    ]);

                    $result = GatewayResult::fromApiResponse($responseData ?? []);

                    if ($result->isSuccess()) {
                        $this->logger->info('[Sandbox][Gateway] Sandbox upgraded successfully', [
                            'message_id' => $messageId,
                        ]);
                    } else {
                        $this->logger->error('[Sandbox][Gateway] Failed to upgrade sandbox', [
                            'message_id' => $messageId,
                            'code' => $result->getCode(),
                            'message' => $result->getMessage(),
                        ]);
                    }

                    return $result;
                } catch (GuzzleException $e) {
                    $isRetryableError = $this->isRetryableError($e);

                    $this->logger->error('[Sandbox][Gateway] HTTP error when upgrading sandbox', [
                        'message_id' => $messageId,
                        'error' => $e->getMessage(),
                        'code' => $e->getCode(),
                        'is_retryable' => $isRetryableError,
                    ]);

                    if (! $isRetryableError) {
                        return GatewayResult::error('HTTP request failed: ' . $e->getMessage());
                    }

                    throw $e;
                } catch (Exception $e) {
                    $this->logger->error('[Sandbox][Gateway] Unexpected error when upgrading sandbox', [
                        'message_id' => $messageId,
                        'error' => $e->getMessage(),
                    ]);
                    return GatewayResult::error('Unexpected error: ' . $e->getMessage());
                }
            }, 1000);
        } catch (Throwable $e) {
            $this->logger->error('[Sandbox][Gateway] All retry attempts failed for upgrading sandbox', [
                'message_id' => $messageId,
                'error' => $e->getMessage(),
            ]);
            return GatewayResult::error('HTTP request failed after retries: ' . $e->getMessage());
        }
    }

    /**
     * Override parent getAuthHeaders to include user-specific headers.
     */
    protected function getAuthHeaders(): array
    {
        $headers = parent::getAuthHeaders();

        if ($this->userId !== null) {
            $headers['magic-user-id'] = $this->userId;
        }

        if ($this->organizationCode !== null) {
            $headers['magic-organization-code'] = $this->organizationCode;
        }

        # 判断header中是否包含request_id，如果没有，从上下文中获取
        if (empty($headers['request-id'])) {
            $requestId = CoContext::getRequestId() ?: (string) IdGenerator::getSnowId();
            $headers['request-id'] = $requestId;
        }

        $traceId = CoContext::getTraceId() ?: (string) IdGenerator::getSnowId();
        $headers['x-b3-trace-id'] = $traceId;
        $headers['tracer.trace_id'] = $traceId;

        return $headers;
    }

    /**
     * Check if the error is retryable.
     * Retryable errors include timeout, connection errors, and 5xx server errors.
     */
    private function isRetryableError(GuzzleException $e): bool
    {
        // First, check for specific Guzzle exception types

        // ConnectException includes all network connection issues (timeouts, DNS errors, etc.)
        if ($e instanceof ConnectException) {
            return true;
        }

        // ServerException for 5xx HTTP errors - these are often temporary
        if ($e instanceof ServerException) {
            return true;
        }

        // For RequestException (parent of many exceptions), check if it has a response
        if ($e instanceof RequestException && $e->hasResponse()) {
            $statusCode = $e->getResponse()->getStatusCode();

            // Retry on 5xx server errors
            if ($statusCode >= 500 && $statusCode < 600) {
                return true;
            }

            // Retry on specific 4xx errors that might be temporary
            $retryable4xxCodes = [
                408, // Request Timeout
                429, // Too Many Requests (rate limiting)
            ];

            if (in_array($statusCode, $retryable4xxCodes)) {
                return true;
            }
        }

        // Fall back to string matching for specific cURL errors (as backup)
        $errorMessage = $e->getMessage();

        // Timeout errors
        if (strpos($errorMessage, 'cURL error 28') !== false) { // Operation timed out
            return true;
        }

        // Connection errors
        if (strpos($errorMessage, 'cURL error 7') !== false) { // Couldn't connect to host
            return true;
        }

        // Other retryable cURL errors
        $retryableCurlErrors = [
            'cURL error 6',  // Couldn't resolve host
            'cURL error 52', // Empty reply from server
            'cURL error 56', // Failure with receiving network data
            'cURL error 35', // SSL connect error
        ];

        foreach ($retryableCurlErrors as $curlError) {
            if (strpos($errorMessage, $curlError) !== false) {
                return true;
            }
        }

        // Don't retry on:
        // - ClientException (4xx errors except 408, 429)
        // - Authentication errors
        // - Bad request format errors
        // - Other non-network related errors

        return false;
    }

    /**
     * 等待沙箱变为 Running 状态
     *
     * @param string $sandboxId 沙箱ID
     * @param string $type 沙箱类型（existing|new）用于日志区分
     * @return string 返回沙箱ID（成功）
     * @throws SandboxOperationException 当等待失败时抛出异常
     */
    private function waitForSandboxRunning(string $sandboxId, string $type): string
    {
        $maxRetries = 15; // 最多等待约30秒
        $retryDelay = 2; // 每次间隔2秒

        $this->logger->info("ensureSandboxAvailable Starting to wait for {$type} sandbox to become running", [
            'sandbox_id' => $sandboxId,
            'type' => $type,
            'max_retries' => $maxRetries,
            'retry_delay' => $retryDelay,
        ]);

        for ($i = 0; $i < $maxRetries; ++$i) {
            $statusResult = $this->getSandboxStatus($sandboxId);

            if ($statusResult->isSuccess() && SandboxStatus::isAvailable($statusResult->getStatus())) {
                $this->logger->info("ensureSandboxAvailable {$type} sandbox is now running", [
                    'sandbox_id' => $sandboxId,
                    'type' => $type,
                    'attempts' => $i + 1,
                ]);
                return $sandboxId;
            }

            // 如果是现有沙箱且状态变为 Exited，提前退出
            if ($type === 'existing' && $statusResult->getStatus() === SandboxStatus::EXITED) {
                $this->logger->info('ensureSandboxAvailable Existing sandbox exited while waiting', [
                    'sandbox_id' => $sandboxId,
                    'current_status' => $statusResult->getStatus(),
                ]);
                throw new SandboxOperationException('Wait for existing sandbox', 'Existing sandbox exited while waiting', 2002);
            }

            $this->logger->info("ensureSandboxAvailable Waiting for {$type} sandbox to become ready...", [
                'sandbox_id' => $sandboxId,
                'type' => $type,
                'current_status' => $statusResult->getStatus(),
                'attempt' => $i + 1,
            ]);
            sleep($retryDelay);
        }

        $this->logger->error("ensureSandboxAvailable Timeout waiting for {$type} sandbox to become running", [
            'sandbox_id' => $sandboxId,
            'type' => $type,
        ]);

        throw new SandboxOperationException('Wait for sandbox ready', "Timeout waiting for {$type} sandbox to become running", 2003);
    }
}
