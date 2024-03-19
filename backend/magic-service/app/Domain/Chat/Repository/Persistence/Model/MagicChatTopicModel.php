<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property string $topic_id
 * @property string $name
 * @property string $description
 * @property int $conversation_id
 * @property string $organization_code
 * @property string $created_at
 * @property string $updated_at
 */
class MagicChatTopicModel extends Model
{
    use SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected ?string $table = 'magic_chat_topics';

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [
        'id',
        'topic_id',
        'name',
        'description',
        'conversation_id',
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
        'conversation_id' => 'string',
    ];
}
