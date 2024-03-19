<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

class MagicDeviceModel extends Model
{
    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_devices';

    /**
     * The connection name for the model.
     */
    protected ?string $connection = 'default';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'type',
        'brand',
        'model',
        'system_version',
        'sdk_version',
        'status',
        'sid',
        'client_addr',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'type' => 'integer',
        'status' => 'integer',
    ];
}
