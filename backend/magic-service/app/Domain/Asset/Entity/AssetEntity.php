<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity;

use App\Domain\Asset\Entity\ValueObject\AssetKind;
use App\Domain\Asset\Entity\ValueObject\AssetMediaType;
use App\Domain\Asset\Entity\ValueObject\AssetStatus;
use App\Domain\Asset\Entity\ValueObject\AssetVisibilityType;
use App\Domain\SuperMagic\Common\Entity\ResolvesI18nText;
use App\Infrastructure\Core\AbstractEntity;

/**
 * magic_assets 表对应的领域实体。
 */
class AssetEntity extends AbstractEntity
{
    use ResolvesI18nText;

    protected ?int $id = null;

    protected string $organizationCode = '';

    protected ?string $userId = null;

    /** 当前素材归属人；历史数据为空时由应用回退到 user_id。 */
    protected ?string $ownerUid = null;

    /** 用于列表模糊搜索的预聚合文本（名称、描述及标签名称）。 */
    protected ?string $searchText = null;

    protected AssetKind $assetKind = AssetKind::ASSET;

    protected ?string $assetBusinessType = null;

    protected ?int $parentId = null;

    protected ?AssetMediaType $assetMediaType = null;

    protected array $nameI18n = [];

    protected ?array $descriptionI18n = null;

    protected ?string $fileKey = null;

    protected ?string $fileUrl = null;

    protected ?string $contentHash = null;

    protected AssetStatus $status = AssetStatus::ENABLED;

    protected AssetVisibilityType $visibilityType = AssetVisibilityType::PERSONAL;

    /** 可见范围配置：用户和部门授权主体。 */
    protected ?array $visibility = null;

    protected ?array $metadata = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    /** API-only enrichment fields; deliberately excluded from persistence payload. */
    protected string $ownerName = '';

    /** @var array<int, array<string, mixed>> */
    protected array $tags = [];

    protected string $source = 'PERSONAL';

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $value): void
    {
        $this->id = $value === null ? null : (int) $value;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $value): void
    {
        $this->organizationCode = $value;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function isOwnedBy(string $organizationCode, string $userId): bool
    {
        return $this->organizationCode === $organizationCode
            && ($this->ownerUid ?: $this->userId) === $userId;
    }

    /** @param array<string> $organizationCodes */
    public function isOfficial(array $organizationCodes): bool
    {
        return in_array($this->organizationCode, $organizationCodes, true);
    }

    public function setUserId(?string $value): void
    {
        $this->userId = $value;
    }

    public function getOwnerUid(): ?string
    {
        return $this->ownerUid;
    }

    public function setOwnerUid(?string $value): void
    {
        $this->ownerUid = $value;
    }

    public function getSearchText(): ?string
    {
        return $this->searchText;
    }

    public function setSearchText(?string $value): void
    {
        $this->searchText = $value;
    }

    public function getOwnerName(): string
    {
        return $this->ownerName;
    }

    public function setOwnerName(string $value): void
    {
        $this->ownerName = $value;
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(array $value): void
    {
        $this->tags = array_values($value);
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function setSource(string $value): void
    {
        $this->source = $value;
    }

    public function getAssetKind(): AssetKind
    {
        return $this->assetKind;
    }

    public function setAssetKind(AssetKind|string $value): void
    {
        $this->assetKind = is_string($value) ? AssetKind::from($value) : $value;
    }

    public function getAssetBusinessType(): ?string
    {
        return $this->assetBusinessType;
    }

    public function setAssetBusinessType(?string $value): void
    {
        $this->assetBusinessType = $value;
    }

    public function getParentId(): ?int
    {
        return $this->parentId;
    }

    public function setParentId(null|int|string $value): void
    {
        $this->parentId = $value === null ? null : (int) $value;
    }

    public function getAssetMediaType(): ?AssetMediaType
    {
        return $this->assetMediaType;
    }

    public function setAssetMediaType(null|AssetMediaType|string $value): void
    {
        $this->assetMediaType = is_string($value) ? AssetMediaType::from($value) : $value;
    }

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $value): void
    {
        $this->nameI18n = $value;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function setDescriptionI18n(?array $value): void
    {
        $this->descriptionI18n = $value;
    }

    public function getI18nName(string $language): string
    {
        return $this->resolveI18nText($this->nameI18n, $language);
    }

    public function getI18nDescription(string $language): string
    {
        return $this->resolveI18nText($this->descriptionI18n, $language);
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $value): void
    {
        $this->fileUrl = $value;
    }

    public function setFileKey(?string $value): void
    {
        $this->fileKey = $value;
    }

    public function getContentHash(): ?string
    {
        return $this->contentHash;
    }

    public function setContentHash(?string $value): void
    {
        $this->contentHash = $value;
    }

    public function getStatus(): AssetStatus
    {
        return $this->status;
    }

    public function setStatus(AssetStatus|bool|int $value): void
    {
        $this->status = $value instanceof AssetStatus ? $value : AssetStatus::from((int) $value);
    }

    public function getVisibilityType(): AssetVisibilityType
    {
        return $this->visibilityType;
    }

    public function setVisibilityType(AssetVisibilityType|string $value): void
    {
        $this->visibilityType = $value instanceof AssetVisibilityType ? $value : AssetVisibilityType::from($value);
    }

    public function getVisibility(): ?array
    {
        return $this->visibility;
    }

    public function setVisibility(?array $value): void
    {
        $this->visibility = $value;
    }

    public function getMetadata(): ?array
    {
        return $this->metadata;
    }

    public function setMetadata(?array $value): void
    {
        $this->metadata = $value;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'owner_uid' => $this->ownerUid,
            'search_text' => $this->searchText,
            'asset_kind' => $this->assetKind->value,
            'asset_business_type' => $this->assetBusinessType,
            'parent_id' => $this->parentId,
            'asset_media_type' => $this->assetMediaType?->value,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'file_key' => $this->fileKey,
            'file_url' => $this->fileUrl,
            'content_hash' => $this->contentHash,
            'status' => $this->status->value,
            'visibility_type' => $this->visibilityType->value,
            'visibility' => $this->visibility,
            'metadata' => $this->metadata,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];
    }
}
