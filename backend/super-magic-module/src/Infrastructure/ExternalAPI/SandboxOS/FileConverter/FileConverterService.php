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

    public function convert(string $userId, string $organizationCode, string $sandboxId, string $projectId, FileConverterRequest $request, string $workDir): FileConverterResponse
    {
        $requestData = $request->toArray();
        try {
            // 使用网关的 ensureSandbox 方法，确保沙箱存在
            $this->gateway->setUserContext($userId, $organizationCode);
            $actualSandboxId = $this->gateway->ensureSandboxAvailable($sandboxId, $projectId, $workDir);

            // 然后直接代理请求到沙箱
            $result = $this->gateway->proxySandboxRequest(
                $actualSandboxId,
                'POST',
                'api/file/converts',
                $requestData
            );

            $response = FileConverterResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('FileConverter Conversion successful', [
                    'original_sandbox_id' => $sandboxId,
                    'actual_sandbox_id' => $actualSandboxId,
                    'project_id' => $projectId,
                    'batch_id' => $response->getBatchId(),
                    'converted_files_count' => count($response->getConvertedFiles()),
                ]);
            } else {
                $this->logger->error('FileConverter Conversion failed', [
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('FileConverter Unexpected error during conversion', [
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
        $this->logger->info('FileConverter Starting query conversion result', [
            'sandbox_id' => $sandboxId,
            'project_id' => $projectId,
            'task_key' => $taskKey,
        ]);

        try {
            // 直接查询转换结果，不检查沙箱状态，因为 create 方法会保证沙箱启动
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'GET',
                'api/file/converts/' . $taskKey,
            );

            $response = FileConverterResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('FileConverter Query conversion result successful', [
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'task_key' => $taskKey,
                    'batch_id' => $response->getBatchId(),
                ]);
            } else {
                // 如果是沙箱不存在或连接失败，提供更明确的错误信息
                $errorMessage = $response->getMessage();
                if (strpos($errorMessage, 'sandbox') !== false || strpos($errorMessage, 'timeout') !== false) {
                    $errorMessage = '沙箱不存在或已退出，无法查询转换结果。请检查沙箱状态或重新提交转换任务。';
                }

                $this->logger->error('FileConverter 查询转换结果，沙箱返回了异常', [
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'task_key' => $taskKey,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                    'user_friendly_message' => $errorMessage,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('FileConverter Unexpected error during query conversion result', [
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
