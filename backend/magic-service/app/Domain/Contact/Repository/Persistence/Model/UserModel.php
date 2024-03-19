<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class UserModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_users';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'magic_id',
        'organization_code',
        'user_id',
        'user_type',
        'description',
        'like_num',
        'label',
        'status',
        'nickname',
        'avatar_url',
        'extra',
        'user_manual',
        'created_at',
        'updated_at',
        'deleted_at',
        'i18n_name',
        'option',
        'profession',
        'channel',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'status' => 'integer',
        'nickname' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
