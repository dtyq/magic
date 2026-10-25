<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class TransferAssetOwnerRequestDTO extends AbstractRequestDTO
{
    public array $assetIds = [];

    public string $ownerUid = '';

    public function setAssetIds(mixed $value): void
    {
        $assetIds = array_map('strval', (array) $value);
        $assetIds = array_filter($assetIds, static fn (string $assetId): bool => trim($assetId) !== '');
        $this->assetIds = array_values(array_unique($assetIds));
    }

    public function setOwnerUid(mixed $value): void
    {
        $this->ownerUid = trim((string) $value);
    }

    public function getAssetIds(): array
    {
        return $this->assetIds;
    }

    public function getOwnerUid(): string
    {
        return $this->ownerUid;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'asset_ids' => 'required|array|min:1|max:100',
            'asset_ids.*' => 'required|string',
            'owner_uid' => 'required|string|max:64',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return ['asset_ids.max' => '素材 ID 列表最多支持 100 个素材'];
    }
}
