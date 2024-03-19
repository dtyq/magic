<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowWaitMessageEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected string $conversationId;

    protected string $originConversationId;

    protected string $messageId;

    protected string $waitNodeId;

    protected string $flowCode;

    protected string $flowVersion;

    /**
     * 超时时间戳.
     * 0 代表永不超时.
     */
    protected int $timeout = 0;

    protected bool $handled = false;

    protected array $persistentData = [];

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    public function prepareForCreation(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->conversationId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'conversation_id']);
        }
        if (empty($this->originConversationId)) {
            $this->originConversationId = $this->conversationId;
        }
        if (empty($this->messageId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'message_id']);
        }
        if (empty($this->waitNodeId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'wait_node_id']);
        }
        if (empty($this->flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        if (empty($this->flowVersion)) {
            // 有可能是没有版本的情况
            $this->flowVersion = '';
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        if (empty($this->modifier)) {
            $this->modifier = $this->creator;
        }
        if (empty($this->updatedAt)) {
            $this->updatedAt = $this->createdAt;
        }

        $this->handled = false;
        $this->id = null;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getOriginConversationId(): string
    {
        return $this->originConversationId;
    }

    public function setOriginConversationId(string $originConversationId): void
    {
        $this->originConversationId = $originConversationId;
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function setMessageId(string $messageId): void
    {
        $this->messageId = $messageId;
    }

    public function getWaitNodeId(): string
    {
        return $this->waitNodeId;
    }

    public function setWaitNodeId(string $waitNodeId): void
    {
        $this->waitNodeId = $waitNodeId;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(string $flowCode): void
    {
        $this->flowCode = $flowCode;
    }

    public function getFlowVersion(): string
    {
        return $this->flowVersion;
    }

    public function setFlowVersion(string $flowVersion): void
    {
        $this->flowVersion = $flowVersion;
    }

    public function getTimeout(): int
    {
        return $this->timeout;
    }

    public function setTimeout(int $timeout): void
    {
        $this->timeout = $timeout;
    }

    public function isHandled(): bool
    {
        return $this->handled;
    }

    public function setHandled(bool $handled): void
    {
        $this->handled = $handled;
    }

    public function getPersistentData(): array
    {
        return $this->persistentData;
    }

    public function setPersistentData(array $persistentData): void
    {
        $this->persistentData = $persistentData;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }
}
