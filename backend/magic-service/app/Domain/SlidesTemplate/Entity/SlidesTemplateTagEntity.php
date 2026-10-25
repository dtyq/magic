<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Entity;

use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagNodeType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SuperMagic\Common\Entity\ResolvesI18nText;
use App\Infrastructure\Core\AbstractEntity;

class SlidesTemplateTagEntity extends AbstractEntity
{
    use ResolvesI18nText;

    protected ?int $id = null;

    protected string $organizationCode = '';

    protected int $parentId = 0;

    protected SlidesTemplateTagNodeType $nodeType = SlidesTemplateTagNodeType::Tag;

    protected string $code = '';

    protected array $nameI18n = [];

    protected array $descriptionI18n = [];

    protected SlidesTemplateTagStatus $status = SlidesTemplateTagStatus::Enabled;

    protected int $sort = 0;

    protected ?string $createdUid = null;

    protected ?string $updatedUid = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    protected int $templateCount = 0;

    /**
     * @var SlidesTemplateTagEntity[]
     */
    protected array $children = [];

    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'parent_id' => $this->parentId,
            'node_type' => $this->nodeType->value,
            'code' => $this->code,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'status' => $this->status->value,
            'sort' => $this->sort,
            'created_uid' => $this->createdUid,
            'updated_uid' => $this->updatedUid,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];

        return array_filter($result, static fn ($value) => $value !== null);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        $this->id = $id === null ? null : (int) $id;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getParentId(): int
    {
        return $this->parentId;
    }

    public function setParentId(null|int|string $parentId): self
    {
        $this->parentId = max(0, (int) ($parentId ?? 0));
        return $this;
    }

    public function getNodeType(): SlidesTemplateTagNodeType
    {
        return $this->nodeType;
    }

    public function setNodeType(SlidesTemplateTagNodeType|string $nodeType): self
    {
        $this->nodeType = $nodeType instanceof SlidesTemplateTagNodeType
            ? $nodeType
            : SlidesTemplateTagNodeType::from($nodeType);
        return $this;
    }

    public function isTag(): bool
    {
        return $this->nodeType === SlidesTemplateTagNodeType::Tag;
    }

    public function isGroup(): bool
    {
        return $this->nodeType === SlidesTemplateTagNodeType::Group;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): self
    {
        $this->code = $code;
        return $this;
    }

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): self
    {
        $this->nameI18n = $nameI18n;
        return $this;
    }

    public function getI18nName(string $language): string
    {
        return $this->resolveI18nText($this->nameI18n, $language);
    }

    public function getI18nDescription(string $language): string
    {
        return $this->resolveI18nText($this->descriptionI18n, $language);
    }

    public function getDescriptionI18n(): array
    {
        return $this->descriptionI18n;
    }

    public function setDescriptionI18n(array $descriptionI18n): self
    {
        $this->descriptionI18n = $descriptionI18n;
        return $this;
    }

    public function getStatus(): SlidesTemplateTagStatus
    {
        return $this->status;
    }

    public function setStatus(int|SlidesTemplateTagStatus $status): self
    {
        $this->status = $status instanceof SlidesTemplateTagStatus ? $status : SlidesTemplateTagStatus::from($status);
        return $this;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int|string $sort): self
    {
        $this->sort = (int) $sort;
        return $this;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): self
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function getUpdatedUid(): ?string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(?string $updatedUid): self
    {
        $this->updatedUid = $updatedUid;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): self
    {
        $this->createdAt = $createdAt === null ? null : (string) $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): self
    {
        $this->updatedAt = $updatedAt === null ? null : (string) $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(mixed $deletedAt): self
    {
        $this->deletedAt = $deletedAt === null ? null : (string) $deletedAt;
        return $this;
    }

    public function getTemplateCount(): int
    {
        return $this->templateCount;
    }

    public function setTemplateCount(null|int|string $templateCount): self
    {
        $this->templateCount = max(0, (int) $templateCount);
        return $this;
    }

    /**
     * @return SlidesTemplateTagEntity[]
     */
    public function getChildren(): array
    {
        return $this->children;
    }

    /**
     * @param SlidesTemplateTagEntity[] $children
     */
    public function setChildren(array $children): self
    {
        $this->children = $children;
        return $this;
    }
}
