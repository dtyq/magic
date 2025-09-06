<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\IntermediateMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicIntermediateDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
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
        // 判断会话的发起者是否是当前用户,并且不是助理
        if ($conversationEntity->getReceiveType() !== ConversationType::Ai && $conversationEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 会话是否已被删除
        if ($conversationEntity->getStatus() === ConversationStatus::Delete) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_DELETED);
        }
    }
}
