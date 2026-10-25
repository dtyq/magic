<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class CreateAssetRequestDTO extends AbstractRequestDTO
{
    public string $assetKind = 'ASSET';

    public ?string $assetBusinessType = 'GENERAL';

    public ?int $parentId = null;

    public ?string $name = null;

    public ?string $description = null;

    public ?string $fileKey = null;

    public ?int $projectId = null;

    public ?string $projectFilePath = null;

    public ?int $status = null;

    /** @var array<int, int|string> */
    public array $tagIds = [];

    /**
     * 兼容前端以 tags 传递选中标签 ID 的请求格式；标准字段仍为 tag_ids。
     * @var array<int, array<string, mixed>|int|string>
     */
    public array $tags = [];

    public function getAssetKind(): string
    {
        return $this->assetKind;
    }

    public function getAssetBusinessType(): ?string
    {
        return $this->assetBusinessType;
    }

    public function getParentId(): ?int
    {
        return $this->parentId;
    }

    public function getNameI18n(): array
    {
        return ['default' => $this->name];
    }

    public function getDescriptionI18n(): array
    {
        return ['default' => $this->description];
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function getProjectFilePath(): ?string
    {
        return $this->projectFilePath;
    }

    public function getTagIds(): array
    {
        $values = $this->tagIds !== [] ? $this->tagIds : $this->tags;
        return array_values(array_unique(array_filter(array_map(
            static function (mixed $value): string {
                if (is_array($value)) {
                    $value = $value['id'] ?? $value['tag_id'] ?? '';
                }
                return is_scalar($value) ? (string) $value : '';
            },
            $values,
        ), static fn (string $id): bool => $id !== '')));
    }

    public function setAssetKind(mixed $value): void
    {
        $this->assetKind = (string) ($value ?: 'ASSET');
    }

    public function setAssetBusinessType(mixed $value): void
    {
        $this->assetBusinessType = $value === null || $value === '' ? 'GENERAL' : (string) $value;
    }

    public function setParentId(mixed $value): void
    {
        $this->parentId = $value === null || $value === '' ? null : (int) $value;
    }

    public function setName(mixed $value): void
    {
        $this->name = $value === null ? null : (string) $value;
    }

    public function setDescription(mixed $value): void
    {
        $this->description = $value === null ? null : (string) $value;
    }

    public function setFileKey(mixed $value): void
    {
        $this->fileKey = $value === null ? null : (string) $value;
    }

    public function setProjectId(mixed $value): void
    {
        $this->projectId = $value === null || $value === '' ? null : (int) $value;
    }

    public function setProjectFilePath(mixed $value): void
    {
        $this->projectFilePath = $value === null || $value === '' ? null : (string) $value;
    }

    public function setStatus(mixed $value): void
    {
        $this->status = $value === null || $value === '' ? null : (int) $value;
    }

    public function setTagIds(mixed $value): void
    {
        $values = is_string($value) ? explode(',', $value) : (array) $value;
        $this->tagIds = array_values(array_unique(array_filter(array_map(
            static fn (mixed $id): string => is_scalar($id) ? (string) $id : '',
            $values,
        ), static fn (string $id): bool => $id !== '')));
    }

    public function setTags(mixed $value): void
    {
        $this->tags = is_string($value) ? explode(',', $value) : (array) $value;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'asset_kind' => 'nullable|string|in:ASSET,GROUP',
            'asset_business_type' => 'nullable|string|max:64',
            'parent_id' => 'nullable|integer|min:1',
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'file_key' => 'nullable|string|max:512',
            'project_id' => 'nullable|integer|min:1|required_with:project_file_path',
            'project_file_path' => 'nullable|string|max:1024|required_with:project_id',
            'status' => 'nullable|integer|in:0,1',
            'tag_ids' => 'nullable',
            'tags' => 'nullable',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'asset_kind.in' => __('asset.validation.asset_kind_in'),
            'asset_business_type.string' => __('asset.validation.asset_business_type_string'),
            'asset_business_type.max' => __('asset.validation.asset_business_type_max'),
            'parent_id.integer' => __('asset.validation.parent_id_integer'),
            'parent_id.min' => __('asset.validation.parent_id_min'),
            'name.string' => __('asset.validation.name_string'),
            'name.max' => __('asset.validation.name_max'),
            'file_key.string' => __('asset.validation.file_key_string'),
            'file_key.max' => __('asset.validation.file_key_max'),
            'status.integer' => __('asset.validation.status_integer'),
            'status.in' => __('asset.validation.status_in'),
        ];
    }
}
