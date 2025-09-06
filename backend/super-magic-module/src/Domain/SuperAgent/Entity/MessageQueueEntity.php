<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use InvalidArgumentException;

/**
 * Message queue entity.
 */
class MessageQueueEntity extends AbstractEntity
{
    /**
     * @var int Message queue ID
     */
    protected int $id = 0;

    /**
     * @var string User ID
     */
    protected string $userId = '';

    /**
     * @var string Organization code
     */
    protected string $organizationCode = '';

    /**
     * @var int Project ID
     */
    protected int $projectId = 0;

    /**
     * @var int Topic ID
     */
    protected int $topicId = 0;

    /**
     * @var string Message content
     */
    protected string $messageContent = '';

    /**
     * @var string Message type
     */
    protected string $messageType = '';

    /**
     * @var int Message status (0=pending, 1=completed, 2=failed, 3=in_progress)
     */
    protected int $status = 0;

    /**
     * @var null|string Execute time
     */
    protected ?string $executeTime = null;

    /**
     * @var null|string Expected execute time
     */
    protected ?string $exceptExecuteTime = null;

    /**
     * @var null|string Error message
     */
    protected ?string $errMessage = null;

    /**
     * @var null|string Deleted time
     */
    protected ?string $deletedAt = null;

    /**
     * @var null|string Created time
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string Updated time
     */
    protected ?string $updatedAt = null;

    /**
     * Get message queue ID.
     */
    public function getId(): int
    {
        return $this->id;
    }

    /**
     * Set message queue ID.
     */
    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    /**
     * Get user ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * Set user ID.
     */
    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * Get organization code.
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * Set organization code.
     */
    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): int
    {
        return $this->projectId;
    }

    /**
     * Set project ID.
     */
    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    /**
     * Get topic ID.
     */
    public function getTopicId(): int
    {
        return $this->topicId;
    }

    /**
     * Set topic ID.
     */
    public function setTopicId(int $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    /**
     * Get message content.
     */
    public function getMessageContent(): string
    {
        return $this->messageContent;
    }

    /**
     * Set message content.
     */
    public function setMessageContent(string $messageContent): self
    {
        $this->messageContent = $messageContent;
        return $this;
    }

    /**
     * Get message type.
     */
    public function getMessageType(): string
    {
        return $this->messageType;
    }

    /**
     * Set message type.
     */
    public function setMessageType(string $messageType): self
    {
        $this->messageType = $messageType;
        return $this;
    }

    /**
     * Get message content as array (decoded from JSON).
     */
    public function getMessageContentAsArray(): array
    {
        if (empty($this->messageContent)) {
            return [];
        }

        $decoded = json_decode($this->messageContent, true);

        // Return decoded array if valid, otherwise return empty array for safety
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Get message status.
     */
    public function getStatus(): MessageQueueStatus
    {
        return MessageQueueStatus::from($this->status);
    }

    /**
     * Set message status.
     */
    public function setStatus(int|MessageQueueStatus $status): self
    {
        if ($status instanceof MessageQueueStatus) {
            $this->status = $status->value;
        } else {
            // Validate int value can be converted to enum
            $this->status = $status;
        }
        return $this;
    }

    /**
     * Get execute time.
     */
    public function getExecuteTime(): ?string
    {
        return $this->executeTime;
    }

    /**
     * Set execute time.
     */
    public function setExecuteTime(?string $executeTime): self
    {
        $this->executeTime = $executeTime;
        return $this;
    }

    /**
     * Get expected execute time.
     */
    public function getExceptExecuteTime(): ?string
    {
        return $this->exceptExecuteTime;
    }

    /**
     * Set expected execute time.
     */
    public function setExceptExecuteTime(?string $exceptExecuteTime): self
    {
        $this->exceptExecuteTime = $exceptExecuteTime;
        return $this;
    }

    /**
     * Get error message.
     */
    public function getErrMessage(): ?string
    {
        return $this->errMessage;
    }

    /**
     * Set error message.
     */
    public function setErrMessage(?string $errMessage): self
    {
        $this->errMessage = $errMessage;
        return $this;
    }

    /**
     * Get deleted time.
     */
    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    /**
     * Set deleted time.
     */
    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    /**
     * Get created time.
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    /**
     * Set created time.
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    /**
     * Get updated time.
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    /**
     * Set updated time.
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    /**
     * Check if message can be modified.
     */
    public function canBeModified(): bool
    {
        return $this->getStatus()->allowsModification();
    }

    /**
     * Check if message can be consumed.
     */
    public function canBeConsumed(): bool
    {
        return $this->getStatus()->canBeConsumed();
    }

    /**
     * Check if message is in final status.
     */
    public function isFinal(): bool
    {
        return $this->getStatus()->isFinal();
    }

    /**
     * Mark message as in progress.
     */
    public function markAsInProgress(): self
    {
        $currentStatus = $this->getStatus();
        if (! in_array(MessageQueueStatus::IN_PROGRESS, $currentStatus->getNextValidStatuses(), true)) {
            throw new InvalidArgumentException('Cannot change status to IN_PROGRESS from current status');
        }

        $this->setStatus(MessageQueueStatus::IN_PROGRESS);
        $this->executeTime = date('Y-m-d H:i:s');
        return $this;
    }

    /**
     * Mark message as completed.
     */
    public function markAsCompleted(): self
    {
        $currentStatus = $this->getStatus();
        if (! in_array(MessageQueueStatus::COMPLETED, $currentStatus->getNextValidStatuses(), true)) {
            throw new InvalidArgumentException('Cannot change status to COMPLETED from current status');
        }

        $this->setStatus(MessageQueueStatus::COMPLETED);
        $this->executeTime = $this->executeTime ?? date('Y-m-d H:i:s');
        return $this;
    }

    /**
     * Mark message as failed.
     */
    public function markAsFailed(string $errorMessage = ''): self
    {
        $currentStatus = $this->getStatus();
        if (! in_array(MessageQueueStatus::FAILED, $currentStatus->getNextValidStatuses(), true)) {
            throw new InvalidArgumentException('Cannot change status to FAILED from current status');
        }

        $this->setStatus(MessageQueueStatus::FAILED);
        $this->executeTime = $this->executeTime ?? date('Y-m-d H:i:s');
        $this->errMessage = $errorMessage;
        return $this;
    }
}
