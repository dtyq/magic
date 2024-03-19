<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Request\Common;

use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\AbstractEntity;
use App\Interfaces\Chat\Assembler\MessageAssembler;

class Message extends AbstractEntity
{
    protected string $appMessageId;

    protected int $sendTime;

    protected string $topicId;

    /**
     * 控制消息或者聊天消息的类型.
     * 根据 type 来确定消息类型是哪一个.
     */
    protected string $type;

    /**
     * 根据 type 的类型,来确定 MagicMessage 的具体类型.
     */
    protected MessageInterface $magicMessage;

    public function __construct(array $data)
    {
        parent::__construct($data);
        $messageType = $this->getType();
        if ($data[$messageType] instanceof MessageInterface) {
            $this->magicMessage = $data[$messageType];
        } else {
            $this->magicMessage = MessageAssembler::getMessageStructByArray($messageType, $data[$messageType]);
        }
    }

    public function getAppMessageId(): string
    {
        return $this->appMessageId ?? '';
    }

    public function setAppMessageId(?string $appMessageId): void
    {
        $this->appMessageId = $appMessageId ?? '';
    }

    public function getSendTime(): int
    {
        return $this->sendTime ?? time();
    }

    public function setSendTime(?int $sendTime): void
    {
        $this->sendTime = $sendTime ?? time();
    }

    public function getTopicId(): string
    {
        return $this->topicId ?? '';
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId ?? '';
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getMagicMessage(): MessageInterface
    {
        return $this->magicMessage;
    }

    public function setMagicMessage(MessageInterface $magicMessage): void
    {
        $this->magicMessage = $magicMessage;
    }
}
