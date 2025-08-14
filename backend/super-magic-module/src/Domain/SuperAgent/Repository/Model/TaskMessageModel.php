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

    // 处理状态常量
    public const PROCESSING_STATUS_PENDING = 'pending';

    public const PROCESSING_STATUS_PROCESSING = 'processing';

    public const PROCESSING_STATUS_COMPLETED = 'completed';

    public const PROCESSING_STATUS_FAILED = 'failed';

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
        'raw_content',
        'steps',
        'tool',
        'attachments',
        'mentions',
        'event',
        'send_timestamp',
        'show_in_ui',
        'raw_data',
        'seq_id',
        'processing_status',
        'error_message',
        'retry_count',
        'processed_at',
        'im_seq_id',
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
        'raw_data' => 'string',
        'seq_id' => 'integer',
        'processing_status' => 'string',
        'error_message' => 'string',
        'retry_count' => 'integer',
        'processed_at' => 'datetime',
        'im_seq_id' => 'integer',
    ];
}
