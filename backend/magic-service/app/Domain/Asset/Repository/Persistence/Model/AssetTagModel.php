<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class AssetTagModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_asset_tags';

    protected array $fillable = [
        'id',
        'organization_code',
        'business_type',
        'parent_id',
        'node_type',
        'name_i18n',
        'status',
        'sort',
        'owner_uid',
        'created_uid',
        'updated_uid',
    ];

    protected array $casts = [
        'id' => 'integer',
        'business_type' => 'string',
        'parent_id' => 'integer',
        'name_i18n' => 'array',
        'status' => 'integer',
        'sort' => 'integer',
        'owner_uid' => 'string',
        'created_uid' => 'string',
        'updated_uid' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
