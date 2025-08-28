<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\DTO\MagicMessageDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\RawMessage;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\IntermediateMessageType;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicIntermediateDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Throwable;

/**
 * 控制消息相关.
 */
class MagicIntermediateMessageAppService extends AbstractAppService
{
    public function __construct(
        protected readonly MagicIntermediateDomainService $magicIntermediateDomainService,
        protected readonly MagicChatDomainService $magicChatDomainService,
    ) {
    }

    /**
     * 根据客户端发来的控制消息类型,分发到对应的处理模块.
     * @throws Throwable
     */
    public function dispatchClientIntermediateMessage(ChatRequest $chatRequest, MagicUserAuthorization $userAuthorization): ?array
    {
        $conversationEntity = $this->magicChatDomainService->getConversationById($chatRequest->getData()->getConversationId());
        if ($conversationEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        $senderUserEntity = $this->magicChatDomainService->getUserInfo($conversationEntity->getUserId());
        $messageDTO = MessageAssembler::getIntermediateMessageDTO(
            $chatRequest,
            $conversationEntity,
            $senderUserEntity
        );
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 消息鉴权
        $this->checkSendMessageAuth($conversationEntity, $dataIsolation);

        $messageContent = $messageDTO->getContent();
        if ($messageContent instanceof RawMessage) {
            $this->handleRawMessage($messageDTO, $conversationEntity, $chatRequest);
            return null;
        }

        match ($messageDTO->getMessageType()) {
            IntermediateMessageType::SuperMagicInstruction => $this->magicIntermediateDomainService->handleSuperMagicInstructionMessage(
                $messageDTO,
                $dataIsolation,
                $conversationEntity,
            ),
            default => ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR),
        };
        return null;
    }

    public function checkSendMessageAuth(MagicConversationEntity $conversationEntity, DataIsolation $dataIsolation): void
    {
        // 检查会话 id所属组织，与当前传入组织编码的一致性
        if ($conversationEntity->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 会话是否已被删除
        if ($conversationEntity->getStatus() === ConversationStatus::Delete) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_DELETED);
        }
    }

    private function handleRawMessage(MagicMessageDTO $messageDTO, MagicConversationEntity $conversationEntity, ChatRequest $chatRequest): void
    {
        $receiveUserEntity = $this->magicChatDomainService->getUserInfo($conversationEntity->getReceiveId());

        $messageEntity = new MagicMessageEntity();
        $messageEntity->setMessageType(ChatMessageType::Raw);
        $messageEntity->setContent($messageDTO->getContent());
        $seqEntity = new MagicSeqEntity();
        $seqEntity->setSeqType(ChatMessageType::Raw);
        $seqEntity->setContent($messageDTO->getContent());
        $seqEntity->setConversationId($chatRequest->getData()->getConversationId());
        $seqEntity->setExtra(new SeqExtra(['topic_id' => $messageDTO->getTopicId()]));
        $seqEntity->setAppMessageId($messageDTO->getAppMessageId());
        $clientSeqStruct = SeqAssembler::getClientSeqStruct($seqEntity, $messageEntity);
        $pushData = $clientSeqStruct->toArray();
        SocketIOUtil::sendIntermediate(SocketEventType::Intermediate, $receiveUserEntity->getMagicId(), $pushData);
    }
}
