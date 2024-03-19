<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class MagicGroupModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_groups';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'group_name',
        'group_avatar',
        'group_notice',
        'group_owner',
        'organization_code',
        'group_tag',
        'group_type',
        'group_status',
        'created_at',
        'updated_at',
        'deleted_at',
        'member_limit',
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
