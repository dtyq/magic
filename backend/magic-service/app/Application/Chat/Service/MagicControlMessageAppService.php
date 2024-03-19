<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Service\MagicControlDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicSeqDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Group\Service\MagicGroupDomainService;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Throwable;

/**
 * 控制消息相关.
 */
class MagicControlMessageAppService extends MagicSeqAppService
{
    public function __construct(
        protected readonly MagicControlDomainService $controlDomainService,
        protected readonly MagicTopicDomainService $topicDomainService,
        protected readonly MagicConversationDomainService $conversationDomainService,
        protected readonly MagicGroupDomainService $groupDomainService,
        protected MagicSeqDomainService $magicSeqDomainService
    ) {
        parent::__construct($magicSeqDomainService);
    }

    /**
     * 根据客户端发来的控制消息类型,分发到对应的处理模块.
     * @throws Throwable
     */
    public function dispatchClientControlMessage(MagicMessageEntity $messageDTO, MagicUserAuthorization $userAuthorization): ?array
    {
        $controlType = $messageDTO->getMessageType();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        if (! $controlType instanceof ControlMessageType) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }
        return match ($controlType) {
            ControlMessageType::CreateConversation,
            ControlMessageType::OpenConversation => $this->conversationDomainService->openConversationWindow($messageDTO, $dataIsolation),
            // 置顶,隐藏,免打扰会话
            ControlMessageType::HideConversation,
            ControlMessageType::MuteConversation,
            ControlMessageType::TopConversation => $this->conversationDomainService->conversationOptionChange($messageDTO, $dataIsolation),
            // 撤回,已读,已读回执,编辑消息
            ControlMessageType::SeenMessages,
            ControlMessageType::ReadMessage,
            ControlMessageType::RevokeMessage,
            ControlMessageType::EditMessage => $this->controlDomainService->clientOperateMessageStatus($messageDTO, $dataIsolation),
            // 创建,更新,删除,设置话题
            ControlMessageType::CreateTopic,
            ControlMessageType::UpdateTopic,
            ControlMessageType::DeleteTopic, => $this->clientOperateTopicMessage($messageDTO, $dataIsolation),
            // （单聊的会话窗口中）开始输入/结束输入
            ControlMessageType::StartConversationInput,
            ControlMessageType::EndConversationInput => $this->conversationDomainService->clientOperateConversationStatus($messageDTO, $dataIsolation),
            // 设置会话话题，准备废弃
            ControlMessageType::SetConversationTopic => [],
            default => ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR),
        };
    }

    /**
     * 分发异步消息队列中的seq.
     * 比如根据发件方的seq,为收件方生成seq,投递seq.
     * @throws Throwable
     */
    public function dispatchMQControlMessage(MagicSeqEntity $magicSeqEntity): void
    {
        $controlMessageType = $magicSeqEntity->getSeqType();
        switch ($controlMessageType) {
            case ControlMessageType::SeenMessages:
            case ControlMessageType::ReadMessage:
                // 已读回执等场景,根据一条控制消息,生成其他人的seq.
                $this->controlDomainService->handlerMQReceiptSeq($magicSeqEntity);
                break;
            case ControlMessageType::RevokeMessage:
            case ControlMessageType::EditMessage:
                // 撤回消息,编辑消息等场景
                $this->controlDomainService->handlerMQUserSelfMessageChange($magicSeqEntity);
                break;
            case ControlMessageType::CreateTopic:
            case ControlMessageType::UpdateTopic:
            case ControlMessageType::DeleteTopic:
                // 话题操作
                $this->handlerMQTopicControlMessage($magicSeqEntity);
                break;
            case ControlMessageType::GroupCreate:
            case ControlMessageType::GroupUsersAdd:
            case ControlMessageType::GroupUsersRemove:
            case ControlMessageType::GroupDisband:
            case ControlMessageType::GroupUpdate:
            case ControlMessageType::GroupOwnerChange:
                // 群操作
                $this->groupDomainService->handlerMQGroupUserChangeSeq($magicSeqEntity);
                break;
        }
    }

    public function clientOperateInstructMessage(MagicMessageEntity $messageEntity, string $conversationId): ?array
    {
        // 给自己的消息流生成序列.
        $seqEntity = $this->controlDomainService->generateSenderSequenceByControlMessage($messageEntity, $conversationId);
        // 异步将生成的消息流通知用户的其他设备.
        $this->controlDomainService->pushControlSequence($seqEntity);
        // 将消息流返回给当前客户端! 但是还是会异步推送给用户的所有在线客户端.
        return SeqAssembler::getClientSeqStruct($seqEntity)->toArray();
    }

    private function clientOperateTopicMessage(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): array
    {
        $conversationId = $this->topicDomainService->clientOperateTopic($messageDTO, $dataIsolation);
        // 给自己的消息流生成序列.
        $seqEntity = $this->controlDomainService->generateSenderSequenceByControlMessage($messageDTO, $conversationId);
        // 异步将生成的消息流通知用户的其他设备.
        $seqCreatedEvent = $this->controlDomainService->pushControlSequence($seqEntity);
        // 异步分发控制消息,对方操作了会话的话题
        $this->controlDomainService->dispatchSeq($seqCreatedEvent);
        // 将消息流返回给当前客户端! 但是还是会异步推送给用户的所有在线客户端.
        return SeqAssembler::getClientSeqStruct($seqEntity)->toArray();
    }

    private function handlerMQTopicControlMessage(MagicSeqEntity $magicSeqEntity): void
    {
        $receiveSeqEntity = $this->topicDomainService->dispatchMQTopicOperation($magicSeqEntity);
        // 异步推送给收件方,有新的话题
        $receiveSeqEntity && $this->controlDomainService->pushControlSequence($receiveSeqEntity);
    }
}
