<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Infrastructure\Core\AbstractRequestDTO;

class QueryAssetRequestDTO extends AbstractRequestDTO
{
    public string $scope = 'PERSONAL';

    public ?string $assetKind = null;

    public ?string $assetBusinessType = null;

    public ?string $assetMediaType = null;

    public ?int $parentId = null;

    public ?string $keyword = null;

    public int $page = 1;

    public int $pageSize = 10;

    public ?int $status = null;

    public ?string $complianceStatus = null;

    /** @var string[] */
    public array $ownerUids = [];

    /** @var array<int, int|string> */
    public array $tagIds = [];

    public string $tagMatch = 'any';

    public function getAssetKind(): ?string
    {
        return $this->assetKind;
    }

    public function getParentId(): ?int
    {
        return $this->parentId;
    }

    public function getScope(): AssetScope
    {
        return AssetScope::fromValue($this->scope);
    }

    public function getAssetBusinessType(): ?string
    {
        return $this->assetBusinessType;
    }

    public function getAssetMediaType(): ?string
    {
        return $this->assetMediaType;
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function getComplianceStatus(): ?string
    {
        return $this->complianceStatus;
    }

    public function getOwnerUids(): array
    {
        return $this->ownerUids;
    }

    public function getTagIds(): array
    {
        return $this->tagIds;
    }

    public function getTagMatch(): string
    {
        return $this->tagMatch;
    }

    public function setScope(mixed $value): void
    {
        $this->scope = (string) ($value ?: 'PERSONAL');
    }

    public function setAssetKind(mixed $value): void
    {
        $this->assetKind = $value === null || $value === '' ? null : (string) $value;
    }

    public function setAssetBusinessType(mixed $value): void
    {
        $this->assetBusinessType = $value === null || $value === '' ? null : (string) $value;
    }

    public function setAssetMediaType(mixed $value): void
    {
        $this->assetMediaType = $value === null || $value === '' ? null : (string) $value;
    }

    public function setParentId(mixed $value): void
    {
        $this->parentId = $value === null || $value === '' ? null : (int) $value;
    }

    public function setKeyword(mixed $value): void
    {
        $this->keyword = $value === null || $value === '' ? null : (string) $value;
    }

    public function setPage(mixed $value): void
    {
        $this->page = $value === null || $value === '' ? 1 : (int) $value;
    }

    public function setPageSize(mixed $value): void
    {
        $this->pageSize = $value === null || $value === '' ? 10 : (int) $value;
    }

    public function setStatus(mixed $value): void
    {
        $this->status = $value === null || $value === '' ? null : (int) $value;
    }

    public function setComplianceStatus(mixed $value): void
    {
        $this->complianceStatus = $value === null || $value === '' ? null : strtoupper((string) $value);
    }

    public function setOwnerUids(mixed $value): void
    {
        $values = is_string($value) ? explode(',', $value) : (array) $value;
        $this->ownerUids = array_values(array_unique(array_filter(array_map('strval', $values), static fn (string $id): bool => trim($id) !== '')));
    }

    public function setTagIds(mixed $value): void
    {
        $values = is_string($value) ? explode(',', $value) : (array) $value;
        $this->tagIds = array_values(array_unique(array_filter(array_map(
            static fn (mixed $id): string => is_scalar($id) ? (string) $id : '',
            $values,
        ), static fn (string $id): bool => $id !== '')));
    }

    public function setTagMatch(mixed $value): void
    {
        $this->tagMatch = in_array((string) $value, ['any', 'all'], true) ? (string) $value : 'any';
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'scope' => 'nullable|string|in:ALL,PERSONAL,TEAM,PUBLIC',
            'asset_kind' => 'nullable|string|in:ASSET,GROUP',
            'asset_business_type' => 'nullable|string|max:64',
            'asset_media_type' => 'nullable|string|in:IMAGE,VIDEO,AUDIO',
            'parent_id' => 'nullable|integer|min:1',
            'keyword' => 'nullable|string|max:128',
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:200',
            'status' => 'nullable|integer|in:0,1',
            'compliance_status' => 'nullable|string|in:PASS',
            'owner_uids' => 'nullable|array',
            'owner_uids.*' => 'string|max:64',
            'tag_ids' => 'nullable',
            'tag_match' => 'nullable|string|in:any,all',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'scope.in' => __('asset.validation.scope_in'),
            'asset_kind.in' => __('asset.validation.asset_kind_in'),
            'asset_business_type.string' => __('asset.validation.asset_business_type_string'),
            'asset_business_type.max' => __('asset.validation.asset_business_type_max'),
            'asset_media_type.in' => __('asset.validation.asset_media_type_in'),
            'parent_id.integer' => __('asset.validation.parent_id_integer'),
            'parent_id.min' => __('asset.validation.parent_id_min'),
            'keyword.string' => __('asset.validation.keyword_string'),
            'keyword.max' => __('asset.validation.keyword_max'),
            'page.integer' => __('asset.validation.page_integer'),
            'page.min' => __('asset.validation.page_min'),
            'page_size.integer' => __('asset.validation.page_size_integer'),
            'page_size.min' => __('asset.validation.page_size_min'),
            'page_size.max' => __('asset.validation.page_size_max'),
            'status.integer' => __('asset.validation.status_integer'),
            'status.in' => __('asset.validation.status_in'),
        ];
    }
}
