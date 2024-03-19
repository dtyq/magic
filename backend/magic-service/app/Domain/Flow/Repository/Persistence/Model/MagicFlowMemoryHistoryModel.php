<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property int $type
 * @property string $request_id
 * @property string $conversation_id
 * @property string $topic_id
 * @property string $message_id
 * @property string $role
 * @property array $content
 * @property string $mount_id
 * @property string $created_uid
 * @property DateTime $created_at
 */
class MagicFlowMemoryHistoryModel extends AbstractModel
{
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'magic_flow_memory_histories';

    protected array $fillable = [
        'id', 'type', 'conversation_id', 'topic_id', 'request_id', 'message_id', 'role', 'content', 'mount_id',
        'created_uid', 'created_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'type' => 'integer',
        'conversation_id' => 'string',
        'topic_id' => 'string',
        'request_id' => 'string',
        'message_id' => 'string',
        'role' => 'string',
        'content' => 'json',
        'mount_id' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
    ];
}
