<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

/**
 * @property int $seq_id
 * @property string $conversation_id
 * @property string $organization_code
 * @property int $topic_id
 * @property string $created_at
 * @property string $updated_at
 */
class MagicChatTopicMessageModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_topic_messages';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'seq_id',
        'conversation_id',
        'organization_code',
        'topic_id',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    /**
     * The attributes that should be cast to native types.
     */
    protected array $casts = [
        'seq_id' => 'string',
        'topic_id' => 'string',
    ];
}
