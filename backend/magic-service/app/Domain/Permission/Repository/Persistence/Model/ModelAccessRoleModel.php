<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $organization_code
 * @property string $name
 * @property null|string $description
 * @property int $is_default
 * @property null|int $parent_role_id
 * @property null|string $created_uid
 * @property null|string $updated_uid
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property null|Carbon $deleted_at
 */
class ModelAccessRoleModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_model_access_roles';

    protected array $fillable = [
        'id',
        'organization_code',
        'name',
        'description',
        'is_default',
        'parent_role_id',
        'created_uid',
        'updated_uid',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'organization_code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'is_default' => 'int',
        'parent_role_id' => 'int',
        'created_uid' => 'string',
        'updated_uid' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
