<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class MagicToken extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_tokens';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'type',
        'type_relation_value',
        'token',
        'expired_at',
        'created_at',
        'updated_at',
        'extra',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'expired_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
