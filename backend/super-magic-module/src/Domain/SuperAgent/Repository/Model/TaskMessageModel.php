<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class TaskMessageModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_agent_message';

    protected string $primaryKey = 'id';

    protected array $fillable = [
        'id',
        'sender_type',
        'sender_uid',
        'receiver_uid',
        'message_id',
        'type',
        'task_id',
        'topic_id',
        'status',
        'content',
        'steps',
        'tool',
        'attachments',
        'mentions',
        'event',
        'send_timestamp',
        'show_in_ui',
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected array $casts = [
        'steps' => 'json',
        'tool' => 'json',
        'attachments' => 'json',
        'mentions' => 'json',
        'event' => 'string',
        'send_timestamp' => 'integer',
        'topic_id' => 'integer',
        'show_in_ui' => 'boolean',
    ];
}
