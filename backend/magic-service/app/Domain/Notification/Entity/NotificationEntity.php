<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Entity;

use App\Domain\Notification\Constant\NotificationActionStatus;
use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Constant\NotificationType;
use App\Infrastructure\Core\AbstractEntity;

final class NotificationEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $organizationCode = '';

    protected string $recipientUserId = '';

    protected ?NotificationCategory $category = null;

    protected ?NotificationType $type = null;

    protected int $templateVersion = 1;

    /** @var array<string, mixed> */
    protected array $payload = [];

    protected string $sourceEventKey = '';

    protected string $sourceDomain = '';

    protected string $sourceType = '';

    protected string $sourceId = '';

    protected ?string $sourceVersion = null;

    protected NotificationMessageStatus $messageStatus = NotificationMessageStatus::ACTIVE;

    protected ?string $readAt = null;

    protected NotificationActionStatus $actionStatus = NotificationActionStatus::NONE;

    protected ?string $actionedAt = null;

    protected ?string $actionedBy = null;

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

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $value): void
    {
        $this->organizationCode = $value;
    }

    public function getRecipientUserId(): string
    {
        return $this->recipientUserId;
    }

    public function setRecipientUserId(string $value): void
    {
        $this->recipientUserId = $value;
    }

    public function getCategory(): ?NotificationCategory
    {
        return $this->category;
    }

    public function setCategory(null|NotificationCategory|string $value): void
    {
        $this->category = $value === null ? null : ($value instanceof NotificationCategory ? $value : NotificationCategory::from($value));
    }

    public function getType(): ?NotificationType
    {
        return $this->type;
    }

    public function setType(null|NotificationType|string $value): void
    {
        $this->type = $value === null ? null : ($value instanceof NotificationType ? $value : NotificationType::from($value));
    }

    public function getTemplateVersion(): int
    {
        return $this->templateVersion;
    }

    public function setTemplateVersion(int $value): void
    {
        $this->templateVersion = $value;
    }

    /** @return array<string, mixed> */
    public function getPayload(): array
    {
        return $this->payload;
    }

    public function setPayload(null|array|string $value): void
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;
        $this->payload = is_array($decoded) ? $decoded : [];
    }

    public function getSourceEventKey(): string
    {
        return $this->sourceEventKey;
    }

    public function setSourceEventKey(string $value): void
    {
        $this->sourceEventKey = $value;
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

    public function getMessageStatus(): NotificationMessageStatus
    {
        return $this->messageStatus;
    }

    public function setMessageStatus(NotificationMessageStatus|string $value): void
    {
        $this->messageStatus = $value instanceof NotificationMessageStatus ? $value : NotificationMessageStatus::from($value);
    }

    public function getReadAt(): ?string
    {
        return $this->readAt;
    }

    public function setReadAt(?string $value): void
    {
        $this->readAt = $value;
    }

    public function getActionStatus(): NotificationActionStatus
    {
        return $this->actionStatus;
    }

    public function setActionStatus(NotificationActionStatus|string $value): void
    {
        $this->actionStatus = $value instanceof NotificationActionStatus ? $value : NotificationActionStatus::from($value);
    }

    public function getActionedAt(): ?string
    {
        return $this->actionedAt;
    }

    public function setActionedAt(?string $value): void
    {
        $this->actionedAt = $value;
    }

    public function getActionedBy(): ?string
    {
        return $this->actionedBy;
    }

    public function setActionedBy(?string $value): void
    {
        $this->actionedBy = $value;
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
