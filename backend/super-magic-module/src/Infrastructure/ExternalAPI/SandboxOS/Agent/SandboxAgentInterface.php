<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InitAgentRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request\InterruptRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;

/**
 * 沙箱Agent接口
 * 定义Agent通信功能，通过Gateway转发实现.
 */
interface SandboxAgentInterface
{
    /**
     * 初始化Agent.
     *
     * @param string $sandboxId 沙箱ID
     * @param InitAgentRequest $request 初始化请求
     * @return AgentResponse 初始化结果
     */
    public function initAgent(string $sandboxId, InitAgentRequest $request): AgentResponse;

    /**
     * 发送聊天消息给Agent.
     *
     * @param string $sandboxId 沙箱ID
     * @param ChatMessageRequest $request 聊天消息请求
     * @return AgentResponse Agent响应
     */
    public function sendChatMessage(string $sandboxId, ChatMessageRequest $request): AgentResponse;

    /**
     * 发送中断消息给Agent.
     *
     * @param string $sandboxId 沙箱ID
     * @param InterruptRequest $request 中断请求
     * @return AgentResponse 中断响应
     */
    public function sendInterruptMessage(string $sandboxId, InterruptRequest $request): AgentResponse;
}
