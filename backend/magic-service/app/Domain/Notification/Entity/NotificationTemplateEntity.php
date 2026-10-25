<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Entity;

use App\Domain\Notification\Constant\NotificationTemplateStatus;
use App\Infrastructure\Core\AbstractEntity;

final class NotificationTemplateEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $templateType = '';

    protected int $version = 0;

    protected string $locale = '';

    protected string $titleTemplate = '';

    protected string $bodyTemplate = '';

    protected NotificationTemplateStatus $status = NotificationTemplateStatus::ACTIVE;

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

    public function getTemplateType(): string
    {
        return $this->templateType;
    }

    public function setTemplateType(string $value): void
    {
        $this->templateType = $value;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $value): void
    {
        $this->version = $value;
    }

    public function getLocale(): string
    {
        return $this->locale;
    }

    public function setLocale(string $value): void
    {
        $this->locale = $value;
    }

    public function getTitleTemplate(): string
    {
        return $this->titleTemplate;
    }

    public function setTitleTemplate(string $value): void
    {
        $this->titleTemplate = $value;
    }

    public function getBodyTemplate(): string
    {
        return $this->bodyTemplate;
    }

    public function setBodyTemplate(string $value): void
    {
        $this->bodyTemplate = $value;
    }

    public function getStatus(): NotificationTemplateStatus
    {
        return $this->status;
    }

    public function setStatus(NotificationTemplateStatus|string $value): void
    {
        $this->status = $value instanceof NotificationTemplateStatus ? $value : NotificationTemplateStatus::from($value);
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
