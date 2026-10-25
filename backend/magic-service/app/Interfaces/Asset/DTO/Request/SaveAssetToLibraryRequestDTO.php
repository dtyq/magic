<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Domain\Asset\Entity\ValueObject\AssetVisibility;

/**
 * 保存到「我的素材库」请求。
 *
 * 相比创建资产：素材只落本地库（不做第三方合规同步），并额外携带可见范围。
 * 名称和描述使用单语言字段，并由父类映射到默认语言。
 */
class SaveAssetToLibraryRequestDTO extends CreateAssetRequestDTO
{
    /** @var array{user_ids?: array<string>, department_ids?: array<string>} */
    public array $visibility = [];

    public function setName(mixed $value): void
    {
        $this->name = $value === null || $value === '' ? null : (string) $value;
    }

    public function getVisibility(): AssetVisibility
    {
        return AssetVisibility::personal(
            (array) ($this->visibility['user_ids'] ?? []),
            (array) ($this->visibility['department_ids'] ?? []),
        );
    }

    public function getVisibilityType(): string
    {
        return $this->hasVisibilityPrincipals() ? 'TEAM' : 'PERSONAL';
    }

    /** @return array{user_ids: array<string>, department_ids: array<string>} */
    public function getVisibilityConfig(): array
    {
        return [
            'user_ids' => array_values(array_map('strval', (array) ($this->visibility['user_ids'] ?? []))),
            'department_ids' => array_values(array_map('strval', (array) ($this->visibility['department_ids'] ?? []))),
        ];
    }

    public function setVisibility(mixed $value): void
    {
        $this->visibility = (array) ($value ?? []);
    }

    /**
     * 该接口只创建素材本身，忽略客户端传入的资产类型。
     */
    public function setAssetKind(mixed $value): void
    {
        $this->assetKind = 'ASSET';
    }

    /**
     * 保存到素材库不挂在素材组下，避免出现指向不存在组的素材。
     */
    public function setParentId(mixed $value): void
    {
        $this->parentId = null;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'file_key' => 'nullable|string|max:512',
            'project_id' => 'nullable|integer|min:1|required_with:project_file_path',
            'project_file_path' => 'nullable|string|max:1024|required_with:project_id',
            'visibility' => 'nullable|array',
            'visibility.user_ids' => 'nullable|array',
            'visibility.department_ids' => 'nullable|array',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name.required' => __('asset.validation.name_required'),
            'name.string' => __('asset.validation.name_string'),
            'name.max' => __('asset.validation.name_max'),
            'file_key.string' => __('asset.validation.file_key_string'),
            'file_key.max' => __('asset.validation.file_key_max'),
            'visibility.array' => __('asset.validation.visibility_array'),
            'visibility.user_ids.array' => __('asset.validation.user_ids_array'),
            'visibility.department_ids.array' => __('asset.validation.department_ids_array'),
        ];
    }

    private function hasVisibilityPrincipals(): bool
    {
        return ($this->visibility['user_ids'] ?? []) !== [] || ($this->visibility['department_ids'] ?? []) !== [];
    }
}
