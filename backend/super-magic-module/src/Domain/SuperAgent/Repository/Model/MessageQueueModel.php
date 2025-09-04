<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model;

use App\Infrastructure\Core\AbstractModel;

/**
 * Message queue model.
 */
class MessageQueueModel extends AbstractModel
{
    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public bool $incrementing = false;

    /**
     * Table name.
     */
    protected ?string $table = 'magic_super_agent_message_queue';

    /**
     * Primary key.
     */
    protected string $primaryKey = 'id';

    /**
     * The data type of the auto-incrementing ID.
     */
    protected string $keyType = 'int';

    /**
     * Fillable fields.
     */
    protected array $fillable = [
        'id',
        'user_id',
        'organization_code',
        'project_id',
        'topic_id',
        'message_content',
        'message_type',
        'status',
        'execute_time',
        'except_execute_time',
        'err_message',
        'deleted_at',
        'created_at',
        'updated_at',
    ];

    /**
     * Date fields.
     */
    protected array $dates = [
        'execute_time',
        'except_execute_time',
        'deleted_at',
        'created_at',
        'updated_at',
    ];

    /**
     * Attributes that should be cast.
     */
    protected array $casts = [
        'id' => 'integer',
        'project_id' => 'integer',
        'topic_id' => 'integer',
        'status' => 'integer',
        'execute_time' => 'datetime',
        'except_execute_time' => 'datetime',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
