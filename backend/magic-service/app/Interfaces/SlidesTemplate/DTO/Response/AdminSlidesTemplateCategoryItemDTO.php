<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

class AdminSlidesTemplateCategoryItemDTO extends SlidesTemplateCategoryItemDTO
{
    public I18nTextDTO $nameI18n;

    public string $organizationCode = '';

    public int $templateCount = 0;

    public int $status = 0;

    public ?string $createdUid = null;

    public ?string $updatedUid = null;

    public ?string $createdAt = null;

    public ?string $updatedAt = null;

    public function __construct(?array $data = null)
    {
        $this->setNameI18n(null);
        parent::__construct($data);
    }

    public function getNameI18n(): I18nTextDTO
    {
        return $this->nameI18n;
    }

    public function setNameI18n(null|array|I18nTextDTO $nameI18n): void
    {
        $this->nameI18n = $nameI18n instanceof I18nTextDTO ? $nameI18n : I18nTextDTO::fromArray($nameI18n ?? []);
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode ?? '';
    }

    public function getTemplateCount(): int
    {
        return $this->templateCount;
    }

    public function setTemplateCount(null|int|string $templateCount): void
    {
        $this->templateCount = $templateCount === null ? 0 : (int) $templateCount;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(null|int|string $status): void
    {
        $this->status = $status === null ? 0 : (int) $status;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getUpdatedUid(): ?string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(?string $updatedUid): void
    {
        $this->updatedUid = $updatedUid;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }
}
