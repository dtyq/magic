<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileConverterResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Exception;
use Hyperf\Logger\LoggerFactory;

class FileConverterService extends AbstractSandboxOS implements FileConverterInterface
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway
    ) {
        parent::__construct($loggerFactory);
    }

    public function convert(string $sandboxId, string $projectId, FileConverterRequest $request): FileConverterResponse
    {
        $requestData = $request->toArray();
        try {
            // 使用网关的 ensureSandboxAndProxy 方法，自动处理沙箱检查和创建
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                $projectId,
                'POST',
                'api/file/converts',
                $requestData
            );

            $response = FileConverterResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $actualSandboxId = $result->getDataValue('actual_sandbox_id') ?? $sandboxId;
                $this->logger->info('[File Converter] Conversion successful', [
                    'original_sandbox_id' => $sandboxId,
                    'actual_sandbox_id' => $actualSandboxId,
                    'project_id' => $projectId,
                    'batch_id' => $response->getBatchId(),
                    'converted_files_count' => count($response->getConvertedFiles()),
                ]);
            } else {
                $this->logger->error('[File Converter] Conversion failed', [
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[File Converter] Unexpected error during conversion', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);

            return FileConverterResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    public function queryConvertResult(string $sandboxId, string $projectId, string $taskKey): FileConverterResponse
    {
        try {
            // 使用网关的 ensureSandboxAndProxy 方法查询转换结果
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                $projectId,
                'GET',
                "api/file/converts/{$taskKey}",
            );

            $response = FileConverterResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $actualSandboxId = $result->getDataValue('actual_sandbox_id') ?? $sandboxId;
                $this->logger->info('[File Converter] Query conversion result successful', [
                    'original_sandbox_id' => $sandboxId,
                    'actual_sandbox_id' => $actualSandboxId,
                    'project_id' => $projectId,
                    'task_key' => $taskKey,
                    'batch_id' => $response->getBatchId(),
                ]);
            } else {
                $this->logger->error('[File Converter] Query conversion result failed', [
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'task_key' => $taskKey,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[File Converter] Unexpected error during query conversion result', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);

            return FileConverterResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}
