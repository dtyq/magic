<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

class MagicContactThirdPlatformIdMappingModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_third_platform_id_mapping';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'origin_id',
        'new_id',
        'third_platform_type',
        'magic_organization_code',
        'magic_environment_id',
        'mapping_type',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
    ];
}
