<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

class AssetTagRelationModel extends AbstractModel
{
    protected ?string $table = 'magic_asset_tag_relations';

    protected array $fillable = [
        'id',
        'organization_code',
        'asset_id',
        'tag_id',
        'created_uid',
    ];

    protected array $casts = [
        'id' => 'integer',
        'asset_id' => 'integer',
        'tag_id' => 'integer',
    ];
}
