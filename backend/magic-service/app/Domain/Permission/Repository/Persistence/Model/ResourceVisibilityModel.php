<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property int $principal_type
 * @property string $principal_id
 * @property int $resource_type
 * @property string $resource_code
 * @property string $creator
 * @property string $modifier
 * @property DateTime $created_at
 * @property DateTime $updated_at
 */
class ResourceVisibilityModel extends AbstractModel
{
    use Snowflake;

    /**
     * Indicates if the model should be timestamped.
     */
    public bool $timestamps = true;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_resource_visibility';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'organization_code',
        'principal_type',
        'principal_id',
        'resource_type',
        'resource_code',
        'creator',
        'modifier',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'principal_type' => 'integer',
        'resource_type' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
