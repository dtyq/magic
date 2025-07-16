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
            // 先检查沙箱状态，避免无谓的请求转发
            $statusResult = $this->gateway->getSandboxStatus($sandboxId);

            if (! $statusResult->isSuccess()) {
                $this->logger->error('FileConverter Failed to get sandbox status', [
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'task_key' => $taskKey,
                    'code' => $statusResult->getCode(),
                    'message' => $statusResult->getMessage(),
                ]);

                return FileConverterResponse::fromApiResponse([
                    'code' => 2000,
                    'message' => '无法获取沙箱状态，请稍后重试',
                    'data' => [],
                ]);
            }

            $sandboxStatus = $statusResult->getStatus();
            $this->logger->info('FileConverter Sandbox status check', [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'sandbox_status' => $sandboxStatus,
            ]);

            // 根据沙箱状态返回相应的提示
            switch ($sandboxStatus) {
                case 'NotFound':
                    return FileConverterResponse::fromApiResponse([
                        'code' => 2001,
                        'message' => '沙箱不存在，转换结果可能已被清理，请重新提交转换任务',
                        'data' => [],
                    ]);

                case 'Pending':
                    return FileConverterResponse::fromApiResponse([
                        'code' => 2002,
                        'message' => '沙箱正在启动中，请稍后查询转换结果',
                        'data' => [],
                    ]);

                case 'Exited':
                    return FileConverterResponse::fromApiResponse([
                        'code' => 2003,
                        'message' => '沙箱已退出，转换结果可能已丢失，请重新提交转换任务',
                        'data' => [],
                    ]);

                case 'Running':
                    // 沙箱正常运行，继续查询转换结果
                    break;
                default:
                    return FileConverterResponse::fromApiResponse([
                        'code' => 2004,
                        'message' => '沙箱状态异常(' . $sandboxStatus . ')，请稍后重试或重新提交转换任务',
                        'data' => [],
                    ]);
            }

            // 查询转换结果不应该自动创建沙箱，因为结果存储在原始沙箱中
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
