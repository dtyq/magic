<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\MemoryType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowMemoryHistoryEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected MemoryType $type;

    protected string $conversationId;

    protected string $topicId = '';

    protected string $requestId;

    protected string $role;

    protected array $content;

    protected string $messageId = '';

    protected string $mountId = '';

    protected string $createdUid;

    protected DateTime $createdAt;

    public function prepareForCreation(): void
    {
        if (empty($this->conversationId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'conversationId 不能为空');
        }
        if (empty($this->requestId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'requestId 不能为空');
        }
        if (empty($this->role)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'role 不能为空');
        }
        if (empty($this->type)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'type 不能为空');
        }
        if (empty($this->content)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'content 不能为空');
        }
        if (empty($this->createdUid)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'createdUid 不能为空');
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getType(): MemoryType
    {
        return $this->type;
    }

    public function setType(MemoryType $type): void
    {
        $this->type = $type;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function setRequestId(string $requestId): void
    {
        $this->requestId = $requestId;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): void
    {
        $this->role = $role;
    }

    public function getContent(): array
    {
        return $this->content;
    }

    public function setContent(array $content): void
    {
        $this->content = $content;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getMountId(): string
    {
        return $this->mountId;
    }

    public function setMountId(string $mountId): void
    {
        $this->mountId = $mountId;
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function setMessageId(string $messageId): void
    {
        $this->messageId = $messageId;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): void
    {
        $this->topicId = $topicId;
    }
}
