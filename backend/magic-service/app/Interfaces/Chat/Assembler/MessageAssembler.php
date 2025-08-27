<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\DTO\MagicMessageDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\AggregateAISearchCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\AggregateAISearchCardMessageV2;
use App\Domain\Chat\DTO\Message\ChatMessage\AIImageCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\FilesMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\ImageConvertHighCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\ImagesMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\MarkdownMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\RawMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessageInterface;
use App\Domain\Chat\DTO\Message\ChatMessage\TextFormMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\UnknowChatMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\VideoMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\VoiceMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\AddFriendMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationEndInputMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationHideMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationMuteMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationSetTopicMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationStartInputMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationTopMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationWindowCreateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationWindowOpenMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupCreateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupDisbandMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupInfoUpdateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupOwnerChangeMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupUserAddMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupUserRemoveMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupUserRoleChangeMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\InstructMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\MessageRevoked;
use App\Domain\Chat\DTO\Message\ControlMessage\MessagesSeen;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicCreateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicDeleteMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicUpdateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\UnknowControlMessage;
use App\Domain\Chat\DTO\Message\IntermediateMessage\SuperMagicInstructionMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\DTO\Request\ControlRequest;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\IntermediateMessageType;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Throwable;

class MessageAssembler
{
    public static function getMessageType(string $messageTypeString): ChatMessageType|ControlMessageType|IntermediateMessageType
    {
        $messageTypeString = strtolower(string_to_line($messageTypeString));
        $messageType = ChatMessageType::tryFrom($messageTypeString);
        $messageType = $messageType ?? ControlMessageType::tryFrom($messageTypeString);
        $messageType = $messageType ?? IntermediateMessageType::tryFrom($messageTypeString);
        if ($messageType === null) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }
        return $messageType;
    }

    /**
     * 根据数组获取消息结构.
     */
    public static function getMessageStructByArray(ChatMessageType|ControlMessageType|string $messageTypeString, array $messageStructArray): MessageInterface
    {
        if (is_string($messageTypeString)) {
            $messageTypeEnum = self::getMessageType($messageTypeString);
        } else {
            $messageTypeEnum = $messageTypeString;
        }
        try {
            if ($messageTypeEnum instanceof ControlMessageType) {
                return self::getControlMessageStruct($messageTypeEnum, $messageStructArray);
            }
            if ($messageTypeEnum instanceof ChatMessageType) {
                return self::getChatMessageStruct($messageTypeEnum, $messageStructArray);
            }
            /* @phpstan-ignore-next-line */
            if ($messageTypeEnum instanceof IntermediateMessageType) {
                return self::getIntermediateMessageStruct($messageTypeEnum, $messageStructArray);
            }
        } catch (BusinessException$exception) {
            throw $exception;
        } catch (Throwable $exception) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, throwable: $exception);
        }
        /* @phpstan-ignore-next-line */
        ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
    }

    public static function getMessageEntity(?array $message): ?MagicMessageEntity
    {
        if (empty($message)) {
            return null;
        }
        return new MagicMessageEntity($message);
    }

    public static function getChatMessageDTOByRequest(
        ChatRequest $chatRequest,
        MagicConversationEntity $conversationEntity,
        MagicUserEntity $senderUserEntity
    ): MagicMessageEntity {
        $time = date('Y-m-d H:i:s');
        $appMessageId = $chatRequest->getData()->getMessage()->getAppMessageId();
        $requestMessage = $chatRequest->getData()->getMessage();
        // 消息的type和content抽象出来
        $messageDTO = new MagicMessageEntity();
        $messageDTO->setSenderId($conversationEntity->getUserId());
        // TODO 会话表应该冗余的记录收发双方的用户类型，目前只记录了收件方的，需要补充
        $senderType = ConversationType::from($senderUserEntity->getUserType()->value);
        $messageDTO->setSenderType($senderType);
        $messageDTO->setSenderOrganizationCode($conversationEntity->getUserOrganizationCode());
        $messageDTO->setReceiveId($conversationEntity->getReceiveId());
        $messageDTO->setReceiveType($conversationEntity->getReceiveType());
        $messageDTO->setReceiveOrganizationCode($conversationEntity->getReceiveOrganizationCode());
        $messageDTO->setAppMessageId($appMessageId);
        $messageDTO->setContent($requestMessage->getMagicMessage());
        $messageDTO->setMessageType($requestMessage->getMagicMessage()->getMessageTypeEnum());
        $messageDTO->setSendTime($time);
        $messageDTO->setCreatedAt($time);
        $messageDTO->setUpdatedAt($time);
        $messageDTO->setDeletedAt(null);
        return $messageDTO;
    }

    public static function getIntermediateMessageDTO(
        ChatRequest $chatRequest,
        MagicConversationEntity $conversationEntity,
        MagicUserEntity $senderUserEntity
    ): MagicMessageDTO {
        $time = date('Y-m-d H:i:s');
        $appMessageId = $chatRequest->getData()->getMessage()->getAppMessageId();
        $requestMessage = $chatRequest->getData()->getMessage();
        $topicId = $chatRequest->getData()->getMessage()->getTopicId();
        // 消息的type和content抽象出来
        $messageDTO = new MagicMessageDTO();
        $messageDTO->setSenderId($conversationEntity->getUserId());
        // TODO 会话表应该冗余的记录收发双方的用户类型，目前只记录了收件方的，需要补充
        $senderType = ConversationType::from($senderUserEntity->getUserType()->value);
        $messageDTO->setSenderType($senderType);
        $messageDTO->setSenderOrganizationCode($conversationEntity->getUserOrganizationCode());
        $messageDTO->setReceiveId($conversationEntity->getReceiveId());
        $messageDTO->setReceiveType($conversationEntity->getReceiveType());
        $messageDTO->setReceiveOrganizationCode($conversationEntity->getReceiveOrganizationCode());
        $messageDTO->setAppMessageId($appMessageId);
        $messageDTO->setContent($requestMessage->getMagicMessage());
        $messageDTO->setMessageType($requestMessage->getMagicMessage()->getMessageTypeEnum());
        $messageDTO->setSendTime($time);
        $messageDTO->setCreatedAt($time);
        $messageDTO->setUpdatedAt($time);
        $messageDTO->setDeletedAt(null);
        $messageDTO->setTopicId($topicId);
        return $messageDTO;
    }

    /**
     * 根据 protobuf 的消息结构,获取对应的消息对象.
     */
    public static function getControlMessageDTOByRequest(ControlRequest $controlRequest, MagicUserAuthorization $userAuthorization, ConversationType $conversationType): MagicMessageEntity
    {
        $appMessageId = $controlRequest->getData()->getMessage()->getAppMessageId();
        $messageStruct = $controlRequest->getData()->getMessage()->getMagicMessage();
        # 将protobuf的消息转换为对应的对象
        $messageEntity = new MagicMessageEntity();
        $messageEntity->setSenderId($userAuthorization->getId());
        $messageEntity->setSenderType($conversationType);
        $messageEntity->setSenderOrganizationCode($userAuthorization->getOrganizationCode());
        $time = date('Y-m-d H:i:s');
        $messageEntity->setAppMessageId($appMessageId);
        // 消息的type和content抽象出来
        $messageEntity->setContent($messageStruct);
        $messageEntity->setMessageType($messageStruct->getMessageTypeEnum());
        $messageEntity->setSendTime($time);
        $messageEntity->setCreatedAt($time);
        $messageEntity->setUpdatedAt($time);
        $messageEntity->setDeletedAt(null);
        return $messageEntity;
    }

    /**
     * 获取聊天消息的结构.
     */
    public static function getChatMessageStruct(ChatMessageType $messageTypeEnum, array $messageStructArray): MessageInterface
    {
        return match ($messageTypeEnum) {
            # 聊天消息
            ChatMessageType::Text => new TextMessage($messageStructArray),
            ChatMessageType::RichText => new RichTextMessage($messageStructArray),
            ChatMessageType::Markdown => new MarkdownMessage($messageStructArray),
            ChatMessageType::AggregateAISearchCard => new AggregateAISearchCardMessage($messageStructArray),
            ChatMessageType::AggregateAISearchCardV2 => new AggregateAISearchCardMessageV2($messageStructArray),
            ChatMessageType::AIImageCard => new AIImageCardMessage($messageStructArray),
            ChatMessageType::ImageConvertHighCard => new ImageConvertHighCardMessage($messageStructArray),
            ChatMessageType::Files => new FilesMessage($messageStructArray),
            ChatMessageType::Image => new ImagesMessage($messageStructArray),
            ChatMessageType::Video => new VideoMessage($messageStructArray),
            ChatMessageType::Voice => new VoiceMessage($messageStructArray),
            ChatMessageType::SuperAgentCard => make(SuperAgentMessageInterface::class, ['messageStruct' => $messageStructArray]),
            ChatMessageType::TextForm => new TextFormMessage($messageStructArray),
            ChatMessageType::Raw => new RawMessage($messageStructArray),
            default => new UnknowChatMessage()
        };
    }

    /**
     * 获取控制消息的结构.
     */
    public static function getControlMessageStruct(ControlMessageType $messageTypeEnum, array $messageStructArray): MessageInterface
    {
        // 其实可以直接使用 protobuf 生成的 php 对象,但是暂时没有时间全量替换,以后再说.
        return match ($messageTypeEnum) {
            # 控制消息
            ControlMessageType::CreateConversation => new ConversationWindowCreateMessage($messageStructArray),
            ControlMessageType::OpenConversation => new ConversationWindowOpenMessage($messageStructArray),
            ControlMessageType::TopConversation => new ConversationTopMessage($messageStructArray),
            ControlMessageType::HideConversation => new ConversationHideMessage($messageStructArray),
            ControlMessageType::MuteConversation => new ConversationMuteMessage($messageStructArray),
            ControlMessageType::SeenMessages => new MessagesSeen($messageStructArray), // 已读
            ControlMessageType::RevokeMessage => new MessageRevoked($messageStructArray), // 撤回
            ControlMessageType::CreateTopic => new TopicCreateMessage($messageStructArray),
            ControlMessageType::UpdateTopic => new TopicUpdateMessage($messageStructArray),
            ControlMessageType::DeleteTopic => new TopicDeleteMessage($messageStructArray),
            ControlMessageType::SetConversationTopic => new ConversationSetTopicMessage($messageStructArray),
            ControlMessageType::StartConversationInput => new ConversationStartInputMessage($messageStructArray),
            ControlMessageType::EndConversationInput => new ConversationEndInputMessage($messageStructArray),
            ControlMessageType::GroupUsersAdd => new GroupUserAddMessage($messageStructArray),
            ControlMessageType::GroupUsersRemove => new GroupUserRemoveMessage($messageStructArray),
            ControlMessageType::GroupUpdate => new GroupInfoUpdateMessage($messageStructArray),
            ControlMessageType::GroupDisband => new GroupDisbandMessage($messageStructArray),
            ControlMessageType::GroupCreate => new GroupCreateMessage($messageStructArray),
            ControlMessageType::GroupUserRoleChange => new GroupUserRoleChangeMessage($messageStructArray),
            ControlMessageType::GroupOwnerChange => new GroupOwnerChangeMessage($messageStructArray),
            ControlMessageType::AgentInstruct => new InstructMessage($messageStructArray),
            ControlMessageType::AddFriendSuccess => new AddFriendMessage($messageStructArray),
            default => new UnknowControlMessage()
        };
    }

    /**
     * 获取临时消息的结构.
     */
    public static function getIntermediateMessageStruct(IntermediateMessageType $messageTypeEnum, array $messageStructArray): MessageInterface
    {
        return match ($messageTypeEnum) {
            IntermediateMessageType::SuperMagicInstruction => new SuperMagicInstructionMessage($messageStructArray),
        };
    }

    /**
     * Builds a length-limited chat history context.
     * To ensure context coherence, this method prioritizes keeping the most recent messages.
     * Current user's messages are kept complete, while other users' messages are truncated to 500 characters.
     *
     * @param array $chatHistoryMessages Chat history messages
     * @param int $maxLength Maximum string length
     * @param string $currentUserNickname Current user's nickname for prioritization
     */
    public static function buildHistoryContext(array $chatHistoryMessages, int $maxLength = 3000, string $currentUserNickname = ''): string
    {
        if (empty($chatHistoryMessages)) {
            return '';
        }

        $limitedMessages = [];
        $currentLength = 0;
        $messageCount = 0;

        // Iterate through messages in reverse to prioritize recent ones
        foreach (array_reverse($chatHistoryMessages) as $message) {
            $role = $message['role'] ?? 'user';
            $content = $message['content'] ?? '';

            if (empty(trim($content))) {
                continue;
            }

            // 如果不是当前用户的消息，且内容超过500字符，则截断
            if (! empty($currentUserNickname) && $role !== $currentUserNickname && mb_strlen($content, 'UTF-8') > 500) {
                $content = mb_substr($content, 0, 500, 'UTF-8') . '...';
            }

            $formattedMessage = sprintf("%s: %s\n", $role, $content);
            $messageLength = mb_strlen($formattedMessage, 'UTF-8');

            // 如果是第一条消息，即使超过长度限制也要包含
            if ($messageCount === 0) {
                array_unshift($limitedMessages, $formattedMessage);
                $currentLength += $messageLength;
                ++$messageCount;
                continue;
            }

            if ($currentLength + $messageLength > $maxLength) {
                // Stop adding messages if the current one exceeds the length limit
                break;
            }

            // Prepend the message to the array to maintain the original chronological order
            array_unshift($limitedMessages, $formattedMessage);
            $currentLength += $messageLength;
            ++$messageCount;
        }

        return implode('', $limitedMessages);
    }
}
