<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Entity;

use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SuperMagic\Common\Entity\ResolvesI18nText;
use App\Infrastructure\Core\AbstractEntity;

class SlidesTemplateEntity extends AbstractEntity
{
    use ResolvesI18nText;

    protected ?int $id = null;

    protected string $organizationCode = '';

    protected SlidesTemplateOwnerType $ownerType = SlidesTemplateOwnerType::Official;

    protected ?string $ownerId = null;

    protected ?int $projectId = null;

    protected ?int $projectDirectoryId = null;

    protected string $code = '';

    protected SlidesTemplateSourceType $sourceType = SlidesTemplateSourceType::Custom;

    protected ?string $categoryCode = null;

    protected array $label = [];

    protected array $description = [];

    protected ?string $searchText = null;

    protected string $thumbnailFileKey = '';

    protected ?string $thumbnailUrl = null;

    protected array $colors = [];

    protected ?string $collageFileKey = null;

    protected ?string $collageUrl = null;

    protected array $previewImageFileKeys = [];

    protected array $previewImageUrls = [];

    protected string $templateFileKey = '';

    protected ?string $templateFileUrl = null;

    protected ?string $previewUrl = null;

    protected SlidesTemplateStatus $status = SlidesTemplateStatus::Enabled;

    protected int $sort = 0;

    protected int $baseUsageCount = 0;

    protected int $actualUsageCount = 0;

    protected int $totalUsageCount = 0;

    /**
     * @var SlidesTemplateTagEntity[]
     */
    protected array $tags = [];

    protected ?string $createdUid = null;

    protected ?string $updatedUid = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public static function generateNewCode(): string
    {
        return 'SLIDE-' . str_replace('.', '-', uniqid('', true));
    }

    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'owner_type' => $this->ownerType->value,
            'owner_id' => $this->ownerId,
            'project_id' => $this->projectId,
            'project_directory_id' => $this->projectDirectoryId,
            'code' => $this->code,
            'source_type' => $this->sourceType->value,
            'category_code' => $this->categoryCode,
            'label' => $this->label,
            'description' => $this->description,
            'search_text' => $this->searchText,
            'thumbnail_file_key' => $this->thumbnailFileKey,
            'colors' => $this->colors,
            'collage_file_key' => $this->collageFileKey,
            'preview_image_file_keys' => $this->previewImageFileKeys,
            'template_file_key' => $this->templateFileKey,
            'preview_url' => $this->previewUrl,
            'status' => $this->status->value,
            'sort' => $this->sort,
            'base_usage_count' => $this->baseUsageCount,
            'actual_usage_count' => $this->actualUsageCount,
            'total_usage_count' => $this->totalUsageCount,
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

    public function getOwnerType(): SlidesTemplateOwnerType
    {
        return $this->ownerType;
    }

    public function setOwnerType(null|SlidesTemplateOwnerType|string $ownerType): self
    {
        if ($ownerType === null || $ownerType === '') {
            $this->ownerType = SlidesTemplateOwnerType::Official;
            return $this;
        }

        $this->ownerType = $ownerType instanceof SlidesTemplateOwnerType
            ? $ownerType
            : SlidesTemplateOwnerType::from($ownerType);
        return $this;
    }

    public function getOwnerId(): ?string
    {
        return $this->ownerId;
    }

    public function setOwnerId(?string $ownerId): self
    {
        $ownerId = trim((string) $ownerId);
        $this->ownerId = $ownerId === '' ? null : $ownerId;
        return $this;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(null|int|string $projectId): self
    {
        if ($projectId === null || $projectId === '') {
            $this->projectId = null;
            return $this;
        }
        $this->projectId = (int) $projectId;
        return $this;
    }

    public function getProjectDirectoryId(): ?int
    {
        return $this->projectDirectoryId;
    }

    public function setProjectDirectoryId(null|int|string $projectDirectoryId): self
    {
        if ($projectDirectoryId === null || $projectDirectoryId === '') {
            $this->projectDirectoryId = null;
            return $this;
        }
        $this->projectDirectoryId = (int) $projectDirectoryId;
        return $this;
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

    public function getSourceType(): SlidesTemplateSourceType
    {
        return $this->sourceType;
    }

    public function setSourceType(null|SlidesTemplateSourceType|string $sourceType): self
    {
        if ($sourceType === null || $sourceType === '') {
            $this->sourceType = SlidesTemplateSourceType::Custom;
            return $this;
        }

        $this->sourceType = $sourceType instanceof SlidesTemplateSourceType ? $sourceType : SlidesTemplateSourceType::from($sourceType);
        return $this;
    }

    public function getCategoryCode(): ?string
    {
        return $this->categoryCode;
    }

    public function setCategoryCode(?string $categoryCode): self
    {
        $categoryCode = trim((string) $categoryCode);
        $this->categoryCode = $categoryCode === '' ? null : $categoryCode;
        return $this;
    }

    public function getLabel(): array
    {
        return $this->label;
    }

    public function getI18nLabel(string $language): string
    {
        return $this->resolveI18nText($this->label, $language);
    }

    public function setLabel(array $label): self
    {
        $this->label = $label;
        return $this;
    }

    public function getDescription(): array
    {
        return $this->description;
    }

    public function getI18nDescription(string $language): string
    {
        return $this->resolveI18nText($this->description, $language);
    }

    public function setDescription(array $description): self
    {
        $this->description = $description;
        return $this;
    }

    public function getSearchText(): ?string
    {
        return $this->searchText;
    }

    public function setSearchText(?string $searchText): self
    {
        $this->searchText = $searchText;
        return $this;
    }

    public function getThumbnailFileKey(): string
    {
        return $this->thumbnailFileKey;
    }

    public function setThumbnailFileKey(?string $thumbnailFileKey): self
    {
        $this->thumbnailFileKey = $thumbnailFileKey ?? '';
        return $this;
    }

    public function getThumbnailUrl(): ?string
    {
        return $this->thumbnailUrl;
    }

    public function setThumbnailUrl(?string $thumbnailUrl): self
    {
        $this->thumbnailUrl = $thumbnailUrl;
        return $this;
    }

    public function getColors(): array
    {
        return $this->colors;
    }

    public function setColors(?array $colors): self
    {
        $this->colors = [];
        foreach ($colors ?? [] as $color) {
            if (! is_string($color)) {
                continue;
            }
            $color = strtoupper(trim($color));
            if (preg_match('/^#[0-9A-F]{6}$/', $color) === 1) {
                $this->colors[] = $color;
            }
        }
        return $this;
    }

    public function getCollageFileKey(): ?string
    {
        return $this->collageFileKey;
    }

    public function setCollageFileKey(?string $collageFileKey): self
    {
        $this->collageFileKey = $collageFileKey;
        return $this;
    }

    public function getCollageUrl(): ?string
    {
        return $this->collageUrl;
    }

    public function setCollageUrl(?string $collageUrl): self
    {
        $this->collageUrl = $collageUrl;
        return $this;
    }

    public function getPreviewImageFileKeys(): array
    {
        return $this->previewImageFileKeys;
    }

    public function setPreviewImageFileKeys(?array $previewImageFileKeys): self
    {
        $this->previewImageFileKeys = $this->normalizeStringList($previewImageFileKeys ?? []);
        return $this;
    }

    public function getPreviewImageUrls(): array
    {
        return $this->previewImageUrls;
    }

    public function setPreviewImageUrls(?array $previewImageUrls): self
    {
        $this->previewImageUrls = $this->normalizeStringList($previewImageUrls ?? []);
        return $this;
    }

    public function getTemplateFileKey(): string
    {
        return $this->templateFileKey;
    }

    public function setTemplateFileKey(string $templateFileKey): self
    {
        $this->templateFileKey = $templateFileKey;
        return $this;
    }

    public function getTemplateFileUrl(): ?string
    {
        return $this->templateFileUrl;
    }

    public function setTemplateFileUrl(?string $templateFileUrl): self
    {
        $this->templateFileUrl = $templateFileUrl;
        return $this;
    }

    public function getPreviewUrl(): ?string
    {
        return $this->previewUrl;
    }

    public function setPreviewUrl(?string $previewUrl): self
    {
        $this->previewUrl = $previewUrl;
        return $this;
    }

    public function getStatus(): SlidesTemplateStatus
    {
        return $this->status;
    }

    public function setStatus(int|SlidesTemplateStatus $status): self
    {
        $this->status = $status instanceof SlidesTemplateStatus ? $status : SlidesTemplateStatus::from($status);
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

    public function getBaseUsageCount(): int
    {
        return $this->baseUsageCount;
    }

    public function setBaseUsageCount(null|int|string $baseUsageCount): self
    {
        $this->baseUsageCount = max(0, (int) $baseUsageCount);
        return $this;
    }

    public function getActualUsageCount(): int
    {
        return $this->actualUsageCount;
    }

    public function setActualUsageCount(null|int|string $actualUsageCount): self
    {
        $this->actualUsageCount = max(0, (int) $actualUsageCount);
        return $this;
    }

    public function getUsageCount(): int
    {
        if ($this->totalUsageCount > 0) {
            return $this->totalUsageCount;
        }

        return $this->baseUsageCount + $this->actualUsageCount;
    }

    public function getTotalUsageCount(): int
    {
        return $this->totalUsageCount;
    }

    public function setTotalUsageCount(null|int|string $totalUsageCount): self
    {
        $this->totalUsageCount = max(0, (int) $totalUsageCount);
        return $this;
    }

    public function recalculateTotalUsageCount(): self
    {
        $this->totalUsageCount = $this->baseUsageCount + $this->actualUsageCount;
        return $this;
    }

    /**
     * @return SlidesTemplateTagEntity[]
     */
    public function getTags(): array
    {
        return $this->tags;
    }

    /**
     * @param SlidesTemplateTagEntity[] $tags
     */
    public function setTags(array $tags): self
    {
        $this->tags = array_values($tags);
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

    private function normalizeStringList(array $values): array
    {
        $list = [];
        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }
            $value = trim($value);
            if ($value !== '') {
                $list[] = $value;
            }
        }
        return $list;
    }
}
