<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property int $resource_type
 * @property string $resource_id
 * @property int $target_type
 * @property string $target_id
 * @property int $operation
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 */
class MagicFlowPermissionModel extends AbstractModel
{
    use SoftDeletes;
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'magic_flow_permissions';

    protected array $fillable = [
        'id', 'organization_code', 'resource_type', 'resource_id', 'target_type', 'target_id', 'operation', 'created_uid', 'created_at', 'updated_uid', 'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'resource_type' => 'integer',
        'resource_id' => 'string',
        'target_type' => 'integer',
        'target_id' => 'string',
        'operation' => 'integer',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
