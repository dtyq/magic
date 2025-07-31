<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

class MagicMessageModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_messages';

    /**
     * The connection name for the model.
     */
    protected ?string $connection = 'default';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'sender_id',
        'sender_type',
        'sender_organization_code',
        'receive_id',
        'receive_type',
        'receive_organization_code',
        'app_message_id',
        'magic_message_id',
        'message_type',
        'content',
        'send_time',
        'language',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'id' => 'string',
    ];
}
