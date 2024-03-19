<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\Chat\Event\Subscribe\Agent\Factory\AgentFactory;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Event\Agent\AgentExecuteInterface;
use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use App\Domain\Chat\Service\MagicConversationDomainService;

class MagicAgentEventAppService implements AgentExecuteInterface
{
    public function __construct(
        protected readonly MagicConversationDomainService $magicConversationDomainService,
    ) {
    }

    public function agentExecEvent(UserCallAgentEvent $userCallAgentEvent)
    {
        $seqEntity = $userCallAgentEvent->seqEntity;
        $agentAccountEntity = $userCallAgentEvent->agentAccountEntity;

        // 流程开始执行前,触发开始输入事件
        if ($seqEntity->canTriggerFlow()) {
            $this->magicConversationDomainService->agentOperateConversationStatusV2(
                ControlMessageType::StartConversationInput,
                $seqEntity->getConversationId(),
                $seqEntity->getExtra()?->getTopicId()
            );
        }

        // 执行流程
        AgentFactory::make($agentAccountEntity->getAiCode())->execute($userCallAgentEvent);

        // 流程执行结束，推送结束输入事件
        // ai准备开始发消息了,结束输入状态
        if ($seqEntity->canTriggerFlow()) {
            $this->magicConversationDomainService->agentOperateConversationStatusV2(
                ControlMessageType::EndConversationInput,
                $seqEntity->getConversationId(),
                $seqEntity->getExtra()?->getTopicId()
            );
        }
    }
}
