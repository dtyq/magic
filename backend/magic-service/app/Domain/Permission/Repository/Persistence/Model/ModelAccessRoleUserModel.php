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
 * @property int $role_id
 * @property string $user_id
 * @property null|string $assigned_by
 * @property null|Carbon $assigned_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property null|Carbon $deleted_at
 */
class ModelAccessRoleUserModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_model_access_role_users';

    protected array $fillable = [
        'id',
        'organization_code',
        'role_id',
        'user_id',
        'assigned_by',
        'assigned_at',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'int',
        'organization_code' => 'string',
        'role_id' => 'int',
        'user_id' => 'string',
        'assigned_by' => 'string',
        'assigned_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
