<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

use App\Domain\Chat\Entity\AbstractEntity;

class LLMStreamCachedDTO extends AbstractEntity
{
    // 避免频繁操作数据库，在内存中缓存发送消息的 sender_message_id
    protected string $senderMessageId;

    // 避免频繁操作数据库，在内存中缓存接收消息的 receive_message_id
    protected string $receiveMessageId;

    // 避免频繁操作数据库，在内存中缓存完整的流式消息内容
    protected ?string $reasoningContent;

    protected string $content;

    protected StreamMessageStatus $status;

    // 避免频繁操作数据库，记录最后一次更新数据库的时间
    protected ?int $lastUpdateDatabaseTime;

    public function getLastUpdateDatabaseTime(): ?int
    {
        return $this->lastUpdateDatabaseTime;
    }

    public function setLastUpdateDatabaseTime(?int $lastUpdateDatabaseTime): self
    {
        $this->lastUpdateDatabaseTime = $lastUpdateDatabaseTime;
        return $this;
    }

    public function getReasoningContent(): ?string
    {
        return $this->reasoningContent;
    }

    public function setReasoningContent(?string $reasoningContent): self
    {
        $this->reasoningContent = $reasoningContent;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): self
    {
        $this->content = $content;
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

    public function getStatus(): StreamMessageStatus
    {
        return $this->status;
    }

    public function setStatus(null|int|StreamMessageStatus|string $status): self
    {
        if (is_numeric($status)) {
            $this->status = StreamMessageStatus::from((int) $status);
        } elseif ($status instanceof StreamMessageStatus) {
            $this->status = $status;
        } elseif ($status === null) {
            $this->status = StreamMessageStatus::Start;
        }
        return $this;
    }
}
