<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Request\Common;

use App\Domain\Chat\DTO\Message\Trait\EditMessageOptionsTrait;
use App\Domain\Chat\Entity\AbstractEntity;

class ChatRequestData extends AbstractEntity
{
    use EditMessageOptionsTrait;

    protected Message $message;

    /**
     * 消息所属的会话ID.
     */
    protected string $conversationId;

    protected string $referMessageId;

    protected ?string $organizationCode = '';

    public function __construct(array $data)
    {
        parent::__construct($data);
    }

    public function getReferMessageId(): string
    {
        return $this->referMessageId ?? '';
    }

    public function setReferMessageId(?string $referMessageId): void
    {
        $this->referMessageId = $referMessageId ?? '';
    }

    public function getMessage(): Message
    {
        return $this->message;
    }

    public function setMessage(null|array|Message $message): void
    {
        if ($message instanceof Message) {
            $this->message = $message;
        } else {
            $this->message = new Message($message ?? []);
        }
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
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
}
