<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 按素材 ID 批量获取资产。
 */
class BatchGetAssetsRequestDTO extends AbstractRequestDTO
{
    /** @var array<int, string> */
    public array $assetIds = [];

    /** @return array<int, string> */
    public function getAssetIds(): array
    {
        return $this->assetIds;
    }

    public function setAssetIds(mixed $value): void
    {
        $values = is_array($value) ? $value : [];
        $this->assetIds = array_values(array_unique(array_filter(
            array_map(static fn (mixed $id): string => is_scalar($id) ? (string) $id : '', $values),
            static fn (string $id): bool => $id !== '',
        )));
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'asset_ids' => 'required|array|min:1|max:500',
            'asset_ids.*' => 'required|string|max:64|regex:/^\d+$/',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'asset_ids.required' => '素材 ID 列表不能为空',
            'asset_ids.array' => '素材 ID 列表必须是数组',
            'asset_ids.min' => '至少需要提供一个素材 ID',
            'asset_ids.max' => '素材 ID 列表最多支持 500 个素材',
            'asset_ids.*.required' => '素材 ID 不能为空',
            'asset_ids.*.string' => '素材 ID 必须是字符串',
            'asset_ids.*.max' => '素材 ID 长度不能超过 64 个字符',
            'asset_ids.*.regex' => '素材 ID 格式不正确，必须是数字',
        ];
    }
}
