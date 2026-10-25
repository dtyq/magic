<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class DeleteAssetDTO extends AbstractDTO
{
    /** 与 AssetDTO.assetId 保持一致：雪花 ID 以字符串返回，避免前端精度丢失。 */
    public string $assetId = '';

    public bool $deleted = false;

    public function __construct(
        int|string $assetId,
        bool $deleted,
    ) {
        $this->assetId = (string) $assetId;
        $this->deleted = $deleted;
        parent::__construct();
    }

    public function getAssetId(): string
    {
        return $this->assetId;
    }

    public function isDeleted(): bool
    {
        return $this->deleted;
    }
}
