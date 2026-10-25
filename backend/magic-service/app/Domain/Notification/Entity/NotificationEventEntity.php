<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Entity;

use App\Domain\Notification\Constant\NotificationEventStatus;
use App\Domain\Notification\Constant\NotificationEventType;
use App\Infrastructure\Core\AbstractEntity;

final class NotificationEventEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $eventId = '';

    protected ?NotificationEventType $eventType = null;

    protected string $organizationCode = '';

    protected string $sourceDomain = '';

    protected string $sourceType = '';

    protected string $sourceId = '';

    protected ?string $sourceVersion = null;

    /** @var array<string, mixed> */
    protected array $eventPayload = [];

    protected NotificationEventStatus $status = NotificationEventStatus::PENDING;

    protected int $attempts = 0;

    protected int $manualRetryCount = 0;

    protected int $recipientCount = 0;

    protected int $notificationCount = 0;

    protected ?string $nextRetryAt = null;

    protected ?string $lastErrorCode = null;

    protected ?string $lastErrorMessage = null;

    protected ?string $processingToken = null;

    protected ?string $lockedUntil = null;

    protected ?string $lastStartedAt = null;

    protected ?string $lastFinishedAt = null;

    protected ?string $lastRetryOperatorId = null;

    protected ?string $lastRetryReason = null;

    protected ?string $lastRetryAt = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $value): void
    {
        $this->id = (string) $value;
    }

    public function getEventId(): string
    {
        return $this->eventId;
    }

    public function setEventId(int|string $value): void
    {
        $this->eventId = (string) $value;
    }

    public function getEventType(): ?NotificationEventType
    {
        return $this->eventType;
    }

    public function setEventType(null|NotificationEventType|string $value): void
    {
        $this->eventType = $value === null ? null : ($value instanceof NotificationEventType ? $value : NotificationEventType::from($value));
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $value): void
    {
        $this->organizationCode = $value;
    }

    public function getSourceDomain(): string
    {
        return $this->sourceDomain;
    }

    public function setSourceDomain(string $value): void
    {
        $this->sourceDomain = $value;
    }

    public function getSourceType(): string
    {
        return $this->sourceType;
    }

    public function setSourceType(string $value): void
    {
        $this->sourceType = $value;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function setSourceId(int|string $value): void
    {
        $this->sourceId = (string) $value;
    }

    public function getSourceVersion(): ?string
    {
        return $this->sourceVersion;
    }

    public function setSourceVersion(null|int|string $value): void
    {
        $this->sourceVersion = $value === null ? null : (string) $value;
    }

    /** @return array<string, mixed> */
    public function getEventPayload(): array
    {
        return $this->eventPayload;
    }

    public function setEventPayload(null|array|string $value): void
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;
        $this->eventPayload = is_array($decoded) ? $decoded : [];
    }

    public function getStatus(): NotificationEventStatus
    {
        return $this->status;
    }

    public function setStatus(NotificationEventStatus|string $value): void
    {
        $this->status = $value instanceof NotificationEventStatus ? $value : NotificationEventStatus::from($value);
    }

    public function getAttempts(): int
    {
        return $this->attempts;
    }

    public function setAttempts(int $value): void
    {
        $this->attempts = $value;
    }

    public function getManualRetryCount(): int
    {
        return $this->manualRetryCount;
    }

    public function setManualRetryCount(int $value): void
    {
        $this->manualRetryCount = $value;
    }

    public function getRecipientCount(): int
    {
        return $this->recipientCount;
    }

    public function setRecipientCount(int $value): void
    {
        $this->recipientCount = $value;
    }

    public function getNotificationCount(): int
    {
        return $this->notificationCount;
    }

    public function setNotificationCount(int $value): void
    {
        $this->notificationCount = $value;
    }

    public function getNextRetryAt(): ?string
    {
        return $this->nextRetryAt;
    }

    public function setNextRetryAt(?string $value): void
    {
        $this->nextRetryAt = $value;
    }

    public function getLastErrorCode(): ?string
    {
        return $this->lastErrorCode;
    }

    public function setLastErrorCode(?string $value): void
    {
        $this->lastErrorCode = $value;
    }

    public function getLastErrorMessage(): ?string
    {
        return $this->lastErrorMessage;
    }

    public function setLastErrorMessage(?string $value): void
    {
        $this->lastErrorMessage = $value;
    }

    public function getProcessingToken(): ?string
    {
        return $this->processingToken;
    }

    public function setProcessingToken(?string $value): void
    {
        $this->processingToken = $value;
    }

    public function getLockedUntil(): ?string
    {
        return $this->lockedUntil;
    }

    public function setLockedUntil(?string $value): void
    {
        $this->lockedUntil = $value;
    }

    public function getLastStartedAt(): ?string
    {
        return $this->lastStartedAt;
    }

    public function setLastStartedAt(?string $value): void
    {
        $this->lastStartedAt = $value;
    }

    public function getLastFinishedAt(): ?string
    {
        return $this->lastFinishedAt;
    }

    public function setLastFinishedAt(?string $value): void
    {
        $this->lastFinishedAt = $value;
    }

    public function getLastRetryOperatorId(): ?string
    {
        return $this->lastRetryOperatorId;
    }

    public function setLastRetryOperatorId(?string $value): void
    {
        $this->lastRetryOperatorId = $value;
    }

    public function getLastRetryReason(): ?string
    {
        return $this->lastRetryReason;
    }

    public function setLastRetryReason(?string $value): void
    {
        $this->lastRetryReason = $value;
    }

    public function getLastRetryAt(): ?string
    {
        return $this->lastRetryAt;
    }

    public function setLastRetryAt(?string $value): void
    {
        $this->lastRetryAt = $value;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $value): void
    {
        $this->createdAt = $value;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $value): void
    {
        $this->updatedAt = $value;
    }
}
