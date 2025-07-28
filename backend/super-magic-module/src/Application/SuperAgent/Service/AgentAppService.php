<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Agent应用服务
 * 负责协调Agent领域服务的调用，遵循DDD原则.
 */
class AgentAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly AgentDomainService $agentDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 获取沙箱状态
     *
     * @param string $sandboxId 沙箱ID
     * @return SandboxStatusResult 沙箱状态结果
     */
    public function getSandboxStatus(string $sandboxId): SandboxStatusResult
    {
        return $this->agentDomainService->getSandboxStatus($sandboxId);
    }

    /**
     * 批量获取沙箱状态
     *
     * @param array $sandboxIds 沙箱ID数组
     * @return BatchStatusResult 批量沙箱状态结果
     */
    public function getBatchSandboxStatus(array $sandboxIds): BatchStatusResult
    {
        return $this->agentDomainService->getBatchSandboxStatus($sandboxIds);
    }

    /**
     * 初始化Agent.
     */
    public function initializeAgent(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        // user long term memory
        $memory = $this->longTermMemoryDomainService->getEffectiveMemoriesForPrompt(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
        );

        $this->agentDomainService->initializeAgent($dataIsolation, $taskContext, $memory);
    }

    /**
     * 发送消息给 agent.
     */
    public function sendChatMessage(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);
    }

    /**
     * 发送中断消息给Agent.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文
     * @param string $sandboxId 沙箱ID
     * @param string $taskId 任务ID
     * @param string $reason 中断原因
     * @return AgentResponse 中断响应
     */
    public function sendInterruptMessage(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskId,
        string $reason,
    ): AgentResponse {
        return $this->agentDomainService->sendInterruptMessage($dataIsolation, $sandboxId, $taskId, $reason);
    }

    /**
     * 获取工作区状态.
     *
     * @param string $sandboxId 沙箱ID
     * @return AgentResponse 工作区状态响应
     */
    public function getWorkspaceStatus(string $sandboxId): AgentResponse
    {
        return $this->agentDomainService->getWorkspaceStatus($sandboxId);
    }

    /**
     * 等待工作区就绪.
     * 轮询工作区状态，直到初始化完成、失败或超时.
     *
     * @param string $sandboxId 沙箱ID
     * @param int $timeoutSeconds 超时时间（秒），默认10分钟
     * @param int $intervalSeconds 轮询间隔（秒），默认2秒
     */
    public function waitForWorkspaceReady(string $sandboxId, int $timeoutSeconds = 600, int $intervalSeconds = 2): void
    {
        $this->logger->info('[Sandbox][App] Waiting for workspace to be ready', [
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => $timeoutSeconds,
            'interval_seconds' => $intervalSeconds,
        ]);

        $startTime = time();
        $endTime = $startTime + $timeoutSeconds;

        while (time() < $endTime) {
            try {
                $response = $this->getWorkspaceStatus($sandboxId);
                $status = $response->getDataValue('status');

                $this->logger->debug('[Sandbox][App] Workspace status check', [
                    'sandbox_id' => $sandboxId,
                    'status' => $status,
                    'status_description' => WorkspaceStatus::getDescription($status),
                    'elapsed_seconds' => time() - $startTime,
                ]);

                // 状态为就绪时退出
                if (WorkspaceStatus::isReady($status)) {
                    $this->logger->info('[Sandbox][App] Workspace is ready', [
                        'sandbox_id' => $sandboxId,
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    return;
                }

                // 状态为错误时抛出异常
                if (WorkspaceStatus::isError($status)) {
                    $this->logger->error('[Sandbox][App] Workspace initialization failed', [
                        'sandbox_id' => $sandboxId,
                        'status' => $status,
                        'status_description' => WorkspaceStatus::getDescription($status),
                        'elapsed_seconds' => time() - $startTime,
                    ]);
                    throw new SandboxOperationException('Wait for workspace ready', 'Workspace initialization failed with status: ' . WorkspaceStatus::getDescription($status), 3001);
                }

                // 等待下一次轮询
                sleep($intervalSeconds);
            } catch (SandboxOperationException $e) {
                // 重新抛出沙箱操作异常
                throw $e;
            } catch (Throwable $e) {
                $this->logger->error('[Sandbox][App] Error while checking workspace status', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                    'elapsed_seconds' => time() - $startTime,
                ]);
                throw new SandboxOperationException('Wait for workspace ready', 'Error checking workspace status: ' . $e->getMessage(), 3002);
            }
        }

        // 超时
        $this->logger->error('[Sandbox][App] Workspace ready timeout', [
            'sandbox_id' => $sandboxId,
            'timeout_seconds' => $timeoutSeconds,
        ]);
        throw new SandboxOperationException('Wait for workspace ready', 'Workspace ready timeout after ' . $timeoutSeconds . ' seconds', 3003);
    }
}
