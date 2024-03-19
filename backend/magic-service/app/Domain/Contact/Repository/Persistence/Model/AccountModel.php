<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class AccountModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_contact_accounts';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'magic_id',
        'type',
        'ai_code',
        'status',
        'country_code',
        'phone',
        'email',
        'real_name',
        'gender',
        'extra',
        'magic_environment_id',
        'password',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'status' => 'integer',
        'type' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
