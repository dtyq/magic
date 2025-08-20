<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;

/**
 * Agent应用服务
 * 负责协调Agent领域服务的调用，遵循DDD原则.
 */
readonly class AgentAppService
{
    public function __construct(
        private AgentDomainService $agentDomainService,
    ) {
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
}
