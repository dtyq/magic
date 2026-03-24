<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence\Model;

use Hyperf\DbConnection\Model\Model;

/**
 * @property string $id
 * @property int $topic_id
 * @property string $task_id
 * @property array $suggestions
 * @property int $status
 * @property string $created_at
 * @property string $updated_at
 */
class MagicChatFollowUpSuggestionModel extends Model
{
    protected ?string $table = 'magic_super_agent_message_suggestions';

    protected array $fillable = [
        'id',
        'topic_id',
        'task_id',
        'suggestions',
        'status',
        'created_at',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'topic_id' => 'integer',
        'suggestions' => 'array',
        'status' => 'integer',
    ];
}
