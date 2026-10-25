<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

class AssetAgreementModel extends AbstractModel
{
    public bool $incrementing = false;

    protected string $keyType = 'int';

    protected ?string $table = 'magic_asset_agreements';

    protected array $fillable = [
        'id', 'organization_code', 'user_id', 'accepted_at', 'created_at', 'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'accepted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
