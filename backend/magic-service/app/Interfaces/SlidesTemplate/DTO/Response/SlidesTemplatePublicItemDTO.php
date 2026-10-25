<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SlidesTemplatePublicItemDTO extends AbstractDTO
{
    public string $id = '';

    public string $code = '';

    public string $sourceType = '';

    public ?string $categoryCode = null;

    public I18nTextDTO $label;

    public I18nTextDTO $description;

    public ?string $thumbnailUrl = null;

    public ?string $color = null;

    public array $colors = [];

    public ?string $collageUrl = null;

    public array $previewImageUrls = [];

    public ?string $previewUrl = null;

    public int $sort = 0;

    public int $usageCount = 0;

    public bool $isOfficial = false;

    public bool $isFavorite = false;

    public int $status = 1;

    public ?string $createdAt = null;

    public ?string $updatedAt = null;

    public array $tags = [];

    public function __construct(?array $data = null)
    {
        $this->setLabel(null);
        $this->setDescription(null);
        parent::__construct($data);
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id === null ? '' : (string) $id;
    }

    public function setCode(?string $code): void
    {
        $this->code = $code ?? '';
    }

    public function getSourceType(): string
    {
        return $this->sourceType;
    }

    public function setSourceType(?string $sourceType): void
    {
        $this->sourceType = $sourceType ?? '';
    }

    public function getCategoryCode(): ?string
    {
        return $this->categoryCode;
    }

    public function setCategoryCode(?string $categoryCode): void
    {
        $this->categoryCode = $categoryCode;
    }

    public function getLabel(): I18nTextDTO
    {
        return $this->label;
    }

    public function setLabel(null|array|I18nTextDTO $label): void
    {
        $this->label = $label instanceof I18nTextDTO ? $label : I18nTextDTO::fromArray($label ?? []);
    }

    public function getDescription(): I18nTextDTO
    {
        return $this->description;
    }

    public function setDescription(null|array|I18nTextDTO $description): void
    {
        $this->description = $description instanceof I18nTextDTO ? $description : I18nTextDTO::fromArray($description ?? []);
    }

    public function getThumbnailUrl(): ?string
    {
        return $this->thumbnailUrl;
    }

    public function setThumbnailUrl(?string $thumbnailUrl): void
    {
        $this->thumbnailUrl = $thumbnailUrl;
    }

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(?string $color): void
    {
        $this->color = $color;
    }

    public function getColors(): array
    {
        return $this->colors;
    }

    public function setColors(?array $colors): void
    {
        $this->colors = [];
        foreach ($colors ?? [] as $color) {
            if (is_string($color) && $color !== '') {
                $this->colors[] = $color;
            }
        }
        $this->color = $this->colors[0] ?? null;
    }

    public function getCollageUrl(): ?string
    {
        return $this->collageUrl;
    }

    public function setCollageUrl(?string $collageUrl): void
    {
        $this->collageUrl = $collageUrl;
    }

    public function getPreviewImageUrls(): array
    {
        return $this->previewImageUrls;
    }

    public function setPreviewImageUrls(?array $previewImageUrls): void
    {
        $this->previewImageUrls = [];
        foreach ($previewImageUrls ?? [] as $previewImageUrl) {
            if (is_string($previewImageUrl) && $previewImageUrl !== '') {
                $this->previewImageUrls[] = $previewImageUrl;
            }
        }
    }

    public function getPreviewUrl(): ?string
    {
        return $this->previewUrl;
    }

    public function setPreviewUrl(?string $previewUrl): void
    {
        $this->previewUrl = $previewUrl;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): void
    {
        $this->sort = $sort === null ? 0 : (int) $sort;
    }

    public function getUsageCount(): int
    {
        return $this->usageCount;
    }

    public function setUsageCount(null|int|string $usageCount): void
    {
        $this->usageCount = $usageCount === null ? 0 : (int) $usageCount;
    }

    public function isOfficial(): bool
    {
        return $this->isOfficial;
    }

    public function setIsOfficial(bool $isOfficial): void
    {
        $this->isOfficial = $isOfficial;
    }

    public function setIsFavorite(bool $isFavorite): void
    {
        $this->isFavorite = $isFavorite;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(array $tags): void
    {
        $this->tags = array_values($tags);
    }
}
