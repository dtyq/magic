<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class SandboxDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly SandboxGatewayInterface $gateway,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 调用沙箱网关，创建沙箱容器，如果 sandboxId 不存在，系统会默认创建一个.
     */
    public function createSandbox(string $projectId, string $sandboxID, string $workDir): string
    {
        $this->logger->info('[Sandbox][App] Creating sandbox', [
            'project_id' => $projectId,
            'sandbox_id' => $sandboxID,
        ]);

        $result = $this->gateway->createSandbox($projectId, $sandboxID, $workDir);

        // 添加详细的调试日志，检查 result 对象
        $this->logger->info('[Sandbox][App] Gateway result analysis', [
            'result_class' => get_class($result),
            'result_is_success' => $result->isSuccess(),
            'result_code' => $result->getCode(),
            'result_message' => $result->getMessage(),
            'result_data_raw' => $result->getData(),
            'result_data_type' => gettype($result->getData()),
            'sandbox_id_via_getDataValue' => $result->getDataValue('sandbox_id'),
            'sandbox_id_via_getData_direct' => $result->getData()['sandbox_id'] ?? 'KEY_NOT_FOUND',
        ]);

        if (! $result->isSuccess()) {
            $this->logger->error('[Sandbox][App] Failed to create sandbox', [
                'project_id' => $projectId,
                'sandbox_id' => $sandboxID,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Create sandbox', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][App] Create sandbox success', [
            'project_id' => $projectId,
            'input_sandbox_id' => $sandboxID,
            'returned_sandbox_id' => $result->getDataValue('sandbox_id'),
        ]);

        return $result->getDataValue('sandbox_id');
    }

    /**
     * 等待工作区就绪.
     * 轮询工作区状态，直到初始化完成、失败或超时.
     *
     * @param string $sandboxId 沙箱ID
     * @param int $timeoutSeconds 超时时间（秒），默认2分钟
     * @param int $intervalSeconds 轮询间隔（秒），默认2秒
     * @throws SandboxOperationException 当初始化失败或超时时抛出异常
     */
    public function waitForSandboxReady(string $sandboxId, int $timeoutSeconds = 120, int $intervalSeconds = 2): void
    {
        $this->logger->info('[Sandbox][App] Waiting for Sandbox to be ready', [
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => $timeoutSeconds,
            'interval_seconds' => $intervalSeconds,
        ]);

        $startTime = time();
        $endTime = $startTime + $timeoutSeconds;

        while (time() < $endTime) {
            try {
                $response = $this->getSandboxStatus($sandboxId);
                $status = $response->getStatus();

                $this->logger->debug('[Sandbox][App] Sandbox status check', [
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // 状态为就绪时退出
                if ($status === SandboxStatus::RUNNING) {
                    $this->logger->info('[Sandbox][App] Sandbox is ready', [
                        'sandbox_id' => $sandboxId,
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    return;
                }

                // 等待下一次轮询
                sleep($intervalSeconds);
            } catch (SandboxOperationException $e) {
                // 重新抛出沙箱操作异常
                throw $e;
            } catch (Throwable $e) {
                $this->logger->error('[Sandbox][App] Error while checking sandbox status', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);
                throw new SandboxOperationException('Wait for sandbox ready', 'Error checking sandbox status: ' . $e->getMessage(), 3002);
            }
        }
    }

    /**
     * 获取沙箱状态
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        $this->logger->info('[Sandbox][App] Getting sandbox status', [
            'sandbox_id' => $sandboxId,
        ]);

        $result = $this->gateway->getSandboxStatus($sandboxId);

        if (! $result->isSuccess() && $result->getCode() !== ResponseCode::NOT_FOUND) {
            $this->logger->error('[Sandbox][App] Failed to get sandbox status', [
                'sandbox_id' => $sandboxId,
                'error' => $result->getMessage(),
                'code' => $result->getCode(),
            ]);
            throw new SandboxOperationException('Get sandbox status', $result->getMessage(), $result->getCode());
        }

        $this->logger->info('[Sandbox][App] Sandbox status retrieved', [
            'sandbox_id' => $sandboxId,
            'status' => $result->getStatus(),
        ]);

        return $result;
    }
}
