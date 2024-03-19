<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property string $group_id
 * @property string $user_id
 */
class MagicGroupUserModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_group_users';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'group_id',
        'user_id',
        'user_role',
        'user_type',
        'status',
        'organization_code',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
