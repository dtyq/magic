<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

use App\Domain\Chat\Entity\AbstractEntity;

class JsonStreamCachedDTO extends AbstractEntity
{
    // 避免频繁操作数据库，在内存中缓存发送消息的 sender_message_id
    protected string $senderMessageId;

    // 避免频繁操作数据库，在内存中缓存接收消息的 receive_message_id
    protected string $receiveMessageId;

    /**
     * 收发双方的 message_id 不同，但是 magic_message_id 相同。
     */
    protected string $magicMessageId;

    /**
     * 收件人的 magic_id.
     */
    protected string $receiveMagicId;

    /**
     * 缓存大 json 数据.
     */
    protected array $content;

    // 避免频繁操作数据库，记录最后一次更新数据库的时间
    protected ?int $lastUpdateDatabaseTime;

    public function getLastUpdateDatabaseTime(): ?int
    {
        return $this->lastUpdateDatabaseTime ?? null;
    }

    public function setLastUpdateDatabaseTime(?int $lastUpdateDatabaseTime): self
    {
        $this->lastUpdateDatabaseTime = $lastUpdateDatabaseTime;
        return $this;
    }

    public function getReceiveMessageId(): ?string
    {
        return $this->receiveMessageId ?? null;
    }

    public function setReceiveMessageId(null|int|string $receiveMessageId): self
    {
        if (is_numeric($receiveMessageId)) {
            $this->receiveMessageId = (string) $receiveMessageId;
        } else {
            $this->receiveMessageId = $receiveMessageId;
        }
        return $this;
    }

    public function getSenderMessageId(): ?string
    {
        return $this->senderMessageId ?? null;
    }

    public function setSenderMessageId(null|int|string $senderMessageId): self
    {
        if (is_numeric($senderMessageId)) {
            $this->senderMessageId = (string) $senderMessageId;
        } else {
            $this->senderMessageId = $senderMessageId;
        }
        return $this;
    }

    public function getContent(): array
    {
        return $this->content ?? [];
    }

    public function setContent(array $content): self
    {
        $this->content = $content;
        return $this;
    }

    public function getMagicMessageId(): ?string
    {
        return $this->magicMessageId ?? null;
    }

    public function setMagicMessageId(null|int|string $magicMessageId): self
    {
        if (is_numeric($magicMessageId)) {
            $this->magicMessageId = (string) $magicMessageId;
        } else {
            $this->magicMessageId = $magicMessageId;
        }
        return $this;
    }

    public function getReceiveMagicId(): ?string
    {
        return $this->receiveMagicId ?? null;
    }

    public function setReceiveMagicId(null|int|string $receiveMagicId): self
    {
        if (is_numeric($receiveMagicId)) {
            $this->receiveMagicId = (string) $receiveMagicId;
        } else {
            $this->receiveMagicId = $receiveMagicId;
        }
        return $this;
    }
}
