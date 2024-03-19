<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Response\Common;

use App\Domain\Chat\DTO\Message\Trait\EditMessageOptionsTrait;
use App\Domain\Chat\Entity\AbstractEntity;
use App\Domain\Chat\Entity\ValueObject\MessageType\MessageOptionsEnum;

/**
 * 客户端收到的消息序列结构.
 */
class ClientSequence extends AbstractEntity
{
    use EditMessageOptionsTrait;

    // 序列号归属账号id
    protected string $magicId;

    // 序列号，一定不重复，一定增长，但是不保证连续。
    protected string $seqId;

    // 用户的消息id，用户下唯一。
    protected string $messageId;

    // 本条消息指向的magic_message_id。 用于实现已读回执场景。存在引用关系时，send_msg_id字段不再返回，因为发送方的消息id没有改变。
    protected ?string $referMessageId;

    // 发送方的消息id
    protected ?string $senderMessageId;

    // 消息所属会话窗口。 客户端可以根据此值确定消息是否要提醒等。如果本地没有发现这个会话id，主动向服务端查询会话窗口详情
    protected ?string $conversationId;

    protected string $organizationCode;

    protected ClientMessage $message;

    public function __construct(array $data)
    {
        parent::__construct($data);
    }

    public function toArray(bool $filterNull = false): array
    {
        $data = [
            'magic_id' => $this->getMagicId(),
            'seq_id' => $this->getSeqId(),
            'message_id' => $this->getMessageId(),
            'refer_message_id' => $this->getReferMessageId(),
            'sender_message_id' => $this->getSenderMessageId(),
            'conversation_id' => $this->getConversationId(),
            'organization_code' => $this->getOrganizationCode(),
            'message' => $this->getMessage()->toArray($filterNull),
        ];
        // edit_message_options 字段大多数时候不需要返回
        $editMessageOptions = $this->getEditMessageOptions();
        if (! empty($editMessageOptions)) {
            $data[MessageOptionsEnum::EDIT_MESSAGE_OPTIONS->value] = $editMessageOptions->toArray();
        }
        return $data;
    }

    public function getMagicId(): string
    {
        return $this->magicId ?? '';
    }

    public function setMagicId(?string $magicId): void
    {
        $magicId !== null && $this->magicId = $magicId;
    }

    public function getSeqId(): string
    {
        return $this->seqId;
    }

    public function setSeqId(?string $seqId): void
    {
        $seqId !== null && $this->seqId = $seqId;
    }

    public function getMessageId(): string
    {
        return $this->messageId ?? '';
    }

    public function setMessageId(?string $messageId): void
    {
        $messageId !== null && $this->messageId = $messageId;
    }

    public function getReferMessageId(): ?string
    {
        return $this->referMessageId ?? null;
    }

    public function setReferMessageId(?string $referMessageId): void
    {
        $this->referMessageId = $referMessageId;
    }

    public function getSenderMessageId(): ?string
    {
        return $this->senderMessageId ?? null;
    }

    public function setSenderMessageId(?string $senderMessageId): void
    {
        $this->senderMessageId = $senderMessageId;
    }

    public function getConversationId(): ?string
    {
        return $this->conversationId ?? null;
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getMessage(): ClientMessage
    {
        return $this->message;
    }

    public function setMessage(array|ClientMessage $message): void
    {
        if ($message instanceof ClientMessage) {
            $this->message = $message;
        } else {
            $this->message = new ClientMessage($message);
        }
    }
}
