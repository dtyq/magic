<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

/**
 * 资产与第三方 Provider 的映射模型。
 */
class AssetProviderAssetModel extends AbstractModel
{
    use SoftDeletes;

    public bool $incrementing = false;

    protected string $keyType = 'int';

    protected ?string $table = 'magic_asset_provider_assets';

    protected array $fillable = [
        'id', 'asset_id', 'organization_code', 'provider_code', 'project_name', 'provider_asset_id',
        'provider_group_id', 'provider_status', 'provider_review_mode', 'provider_failed_reason', 'metadata', 'created_at', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer', 'asset_id' => 'integer', 'organization_code' => 'string',
        'provider_code' => 'string', 'project_name' => 'string', 'provider_asset_id' => 'string', 'provider_group_id' => 'string',
        'provider_status' => 'string', 'provider_review_mode' => 'string', 'provider_failed_reason' => 'string', 'metadata' => 'array', 'created_at' => 'datetime',
        'updated_at' => 'datetime', 'deleted_at' => 'datetime',
    ];
}
