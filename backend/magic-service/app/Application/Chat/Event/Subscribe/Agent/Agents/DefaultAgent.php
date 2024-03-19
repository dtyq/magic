<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\Agent\Agents;

use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

use function di;

class DefaultAgent extends AbstractAgent
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function execute(UserCallAgentEvent $event): void
    {
        $seqEntity = $event->seqEntity;
        $messageEntity = $event->messageEntity;
        $agentAccountEntity = $event->agentAccountEntity;
        $agentUserEntity = $event->agentUserEntity;
        $senderUserEntity = $event->senderUserEntity;
        $senderAccountEntity = $event->senderAccountEntity;
        $senderExtraDTO = $event->senderExtraDTO;
        $logMessageData = $messageEntity?->toArray();
        unset($logMessageData['message_content']);
        $this->logger->info('ImChatMessageStart', [
            'seq' => $seqEntity->toArray(),
            'message' => $logMessageData,
        ]);
        // 获取触发类型
        $triggerType = TriggerType::fromSeqType($seqEntity->getSeqType());
        # 传入的参数:
        // 1. $userAccountEntity 包含真名,手机号等有安全风险,应该需要auth授权的信息
        // 2. $userEntity 用户详情,包含用户id,用户昵称,用户头像等信息
        // 3. $seqEntity 会话窗口id,引用的message_id,消息类型(聊天消息/打开了会话窗口)
        // 4. $messageEntity 保存有消息类型,消息的具体内容,发件人id,发送时间
        $this->getMagicFlowExecuteAppService()->imChat(
            $agentAccountEntity->getAiCode(),
            $triggerType,
            [
                'agent_account' => $agentAccountEntity,
                'agent' => $agentUserEntity,
                'sender' => $senderUserEntity,
                'sender_account' => $senderAccountEntity,
                'seq' => $seqEntity,
                'message' => $messageEntity,
                'sender_extra' => $senderExtraDTO,
            ],
        );
    }

    private function getMagicFlowExecuteAppService(): MagicFlowExecuteAppService
    {
        return di(MagicFlowExecuteAppService::class);
    }
}
