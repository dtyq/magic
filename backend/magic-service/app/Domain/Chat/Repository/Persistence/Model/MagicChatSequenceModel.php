<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

/**
 * @property int $id
 * @property string $organization_code
 * @property int $object_type
 * @property string $object_id
 * @property string $seq_id
 * @property string $seq_type
 * @property string $content
 * @property string $receive_list
 * @property string $magic_message_id
 * @property string $message_id
 * @property string $refer_message_id
 * @property string $sender_message_id
 * @property string $conversation_id
 * @property int $status
 * @property string $extra
 * @property string $created_at
 * @property string $updated_at
 * @property string $app_message_id
 * @property string $deleted_at
 */
class MagicChatSequenceModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_sequences';

    /**
     * The connection name for the model.
     */
    protected ?string $connection = 'default';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'organization_code',
        'object_type',
        'object_id',
        'seq_id',
        'seq_type',
        'content',
        'receive_list',
        'magic_message_id',
        'message_id',
        'refer_message_id',
        'sender_message_id',
        'conversation_id',
        'status',
        'extra',
        'created_at',
        'updated_at',
        'app_message_id',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'extra' => 'string',
    ];
}
